"use strict";

const Mandelbrot = function (element) {
    const self = this;
    self.dom = element;
    self.params = {
        supersampling: 4.,
        u_center: { value: new THREE.Vector2(0., 0.) },
        // u_center: { value: new THREE.Vector2(0.27227873492114013, -0.005306100126992294) },
        u_scale: { value: 0.25 },
        // u_scale: { value: 24000.81839988776 },
        u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        u_maxIter: { value: 1000 },
        domSize: new THREE.Vector2(),
        u_hueCycle: { value: 40 },
        u_hueShift: {value: 0}
    };
    self.drawingCost = 0.0;
    self.init();
    self.drawLoop();
    self.initGUI();
}

Mandelbrot.prototype.init = function () {
    const self = this;
    self.renderer = new THREE.WebGLRenderer({
        canvas: self.dom
    });

    self.scene = new THREE.Scene();

    self.camera = new THREE.OrthographicCamera();
    self.camera.position.set(0.0, 0.0, 1.0);
    self.camera.lookAt(new THREE.Vector3(0.0, 0.0, 0.0))
    self.scene.add(self.camera);

    const planeGeometry = new THREE.PlaneGeometry(2.0, 2.0);
    const planeMaterial = new THREE.ShaderMaterial({
        vertexShader: self.vertexShaderSource,
        fragmentShader: self.fragmentShaderSource,
        uniforms: self.params,
    });
    self.planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
    self.scene.add(self.planeMesh)

    self.handleResize();
    self.hammertime = new Hammer.Manager(self.dom, {
        recognizers: [
            [Hammer.Pinch, { enable: true }],
            [Hammer.Pan],
        ]
    });
    self.initGestures();
}

Mandelbrot.prototype.draw = function () {
    this.needsRender = true;
}

Mandelbrot.prototype.drawLoop = function () {
    const self = this;
    requestAnimationFrame(() => self.drawLoop());
    this.drawLoopStep();
}

Mandelbrot.prototype.drawLoopStep = function (time) {
    const self = this;
    if (self.drawStart > 0.) {
        self.drawingCost = Date.now() - self.drawStart;
        self.drawStart = 0.;
    }
    if (self.needsRender) {
        self.drawStart = Date.now();
        self.renderer.render(self.scene, self.camera);
        self.needsRender = false;
    }
}

Mandelbrot.prototype.updateCameraByAspect = function () {
    const self = this;
    self.camera.aspect = self.aspect;
    self.camera.left = -1.0 * self.aspect;
    self.camera.right = 1.0 * self.aspect;
    self.camera.top = 1.0;
    self.camera.bottom = -1.0;
    self.camera.near = 0.0;
    self.camera.far = 2.0;
    self.camera.updateProjectionMatrix();
}

Mandelbrot.prototype.updatePlaneByAspect = function () {
    const self = this;
    self.planeMesh.geometry.dispose();
    self.planeMesh.geometry = new THREE.PlaneGeometry(2.0 * self.aspect, 2.0);
}

Mandelbrot.prototype.adjustRenderer = function () {
    const self = this;
    const w = self.dom.width;
    const h = self.dom.height;
    const ws = w * self.params.supersampling;
    const hs = h * self.params.supersampling;
    self.renderer.setSize(ws, hs);
    self.params.u_resolution.value.set(ws, hs);
    self.params.domSize.set(w, h);
    self.renderer.domElement.style.width = `${w}px`;
    self.renderer.domElement.style.height = `${h}px`;
}

Mandelbrot.prototype.handleResize = function () {
    const self = this;
    self.aspect = self.dom.width / self.dom.height;
    self.updateCameraByAspect();
    self.updatePlaneByAspect();
    self.adjustRenderer();
    self.draw();
}

Mandelbrot.prototype.screenPointToAxes = function (screen) {
    const self = this;
    return screen.clone().multiply(new THREE.Vector2(1.0, -1.0))
        .sub(self.params.domSize.clone().multiply(new THREE.Vector2(0.5, -0.5)))
        .divideScalar(
            Math.min(self.params.domSize.y, self.params.domSize.x)
            * self.params.u_scale.value
        )
        .add(self.params.u_center.value);
}

Mandelbrot.prototype.screenVecToAxes = function (screen) {
    const self = this;
    return screen.clone().multiply(new THREE.Vector2(1.0, -1.0))
        .divideScalar(
            Math.min(self.params.domSize.y, self.params.domSize.x)
            * self.params.u_scale.value
        );
}

Mandelbrot.prototype.initGestures = function () {
    const self = this;
    let startCenter = new THREE.Vector2();
    self.hammertime.on('panstart', function (ev) {
        startCenter.copy(self.params.u_center.value);
    })
    self.hammertime.on('panmove', function (ev) {
        const delta = self.screenVecToAxes(new THREE.Vector2(ev.deltaX, ev.deltaY))
        self.params.u_center.value.copy(startCenter.clone().sub(delta));
        self.draw();
    })
    self.dom.addEventListener("wheel", function (ev) {
        const dScale = ev.deltaY > 0 ? 1 / 1.1 : 1.1;
        const point = self.screenPointToAxes(new THREE.Vector2(ev.offsetX, ev.offsetY))
        const delta = self.params.u_center.value.clone().sub(point);
        self.params.u_center.value.copy(point.clone().add(delta.clone().divideScalar(dScale)));
        self.params.u_scale.value *= dScale;
        self.draw();
    })
    let startScale;
    let startPoint;
    self.hammertime.on('pinchstart', function (ev) {
        startCenter.copy(self.params.u_center.value);
        startScale = self.params.u_scale.value;
        startPoint = self.screenPointToAxes(new THREE.Vector2(ev.center.x, ev.center.y));
    });
    self.hammertime.on('pinchmove', function (ev) {
        const N = startCenter.clone().sub(startPoint).divideScalar(ev.scale).add(startPoint);
        const delta = self.screenVecToAxes(new THREE.Vector2(ev.deltaX, ev.deltaY));
        self.params.u_center.value.copy(N.clone().sub(delta));
        self.params.u_scale.value = ev.scale * startScale;
        self.draw();
    })
}

Mandelbrot.prototype.initGUI = function () {
    const self = this;
    const parameters = {
        centerX: () => self.params.u_center.value.x.toString()
    }
    self.gui = new lil.GUI();
    self.gui.add(self.params.u_center.value, 'x', -2, 2, 0.000001).name('Center x').listen().disable()
    self.gui.add(self.params.u_center.value, 'y', -2, 2, 0.000001).name('Center y').listen().disable()
    self.gui.add(self.params.u_scale, 'value', 0.1, 100000, 0.000001).name('Scale').listen().disable()
    self.gui.add(self.params.u_hueCycle, 'value', 1, 200, 1).name('# of colors').listen().onChange(function (value) {
        self.params.u_hueCycle.value = parseInt(value)
        self.draw()
    });
    self.gui.add(self.params.u_hueShift, 'value', 0, 500, 1).name('color shift (%)').listen().onChange(function (value) {
        self.params.u_hueShift.value = parseInt(value)
        self.draw()
    });
    self.gui.add(self.params.u_maxIter, 'value', 1, 10000, 1).name('Max Iter').listen().onChange(function (value) {
        self.params.u_maxIter.value = parseInt(value)
        self.draw()
    });
    self.gui.add(self, 'drawingCost', 0, 100, 0.01).name('Last Cost (ms)').listen().disable();
}

Mandelbrot.prototype.vertexShaderSource = /*glsl*/`
    void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

Mandelbrot.prototype.fragmentShaderSource = /*glsl*/`
    precision highp float;
    uniform vec2 u_center;
    uniform float u_scale;
    uniform vec2 u_resolution;
    uniform int u_maxIter;
    uniform int u_hueCycle;
    uniform float u_hueShift;

    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    void main() {
        vec2 c = (((gl_FragCoord.xy - u_resolution * 0.5) 
            / min(u_resolution.x, u_resolution.y)))  / u_scale + u_center;
        float x = 0.0;
        float y = 0.0;
        float l = 0.0;
        int j = 0;
        for (int i = 0; i < u_maxIter; i++) {
            l = x * x + y * y;
            if (l > 4.0) break;
            float xx = (x * x - y * y) + c.x;
            y = (2.0 * x * y) + c.y;
            x = xx;
            j = i;
        }
        vec4 color1 = vec4(hsv2rgb(vec3(mod(float(j+int(u_hueShift/100.*float(u_hueCycle))), float(u_hueCycle))/float(u_hueCycle), 1.0, 1.0)), 1.0);
        vec4 color2 = vec4(hsv2rgb(vec3(mod(float(j+int(u_hueShift/100.*float(u_hueCycle))+1), float(u_hueCycle))/float(u_hueCycle), 1.0, 1.0)), 1.0);
        float v = 1. - log(log(l)/log(4.))/log(2.);
        gl_FragColor = mix(color1, color2, v)
            * vec4(vec3(1.0-float(j>=u_maxIter-1)), 1.);
    }
`;


Mandelbrot.prototype.fragmentShaderSource1= /*glsl*/`
    precision highp float;
    uniform vec2 u_center;
    uniform float u_scale;
    uniform vec2 u_resolution;
    uniform int u_maxIter;

    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    void main() {
        vec2 c = (((gl_FragCoord.xy - u_resolution * 0.5) 
            / min(u_resolution.x, u_resolution.y)))  / u_scale + u_center;
        float x = 0.0;
        float y = 0.0;
        const int hue_cycle = 10;
        int j = 0;
        for (int i = 0; i < u_maxIter; i++) {
            if ((x * x+ y * y) > 4.0) break;
            float xx = (x * x - y * y) + c.x;
            y = (2.0 * x * y) + c.y;
            x = xx;
            j = i;
        }
        float hue = float(j);
        hue = hue - float(int(hue / float(hue_cycle))) * float(hue_cycle);
        hue = hue / float(hue_cycle);
        float maxed =  float(1 - int(j==u_maxIter-1));
        gl_FragColor = vec4(maxed, maxed, maxed, 1.0) * vec4(hsv2rgb(vec3(hue, 1.0, 1.0)), 1.0);
    }
`;


window.Mandelbrot = Mandelbrot

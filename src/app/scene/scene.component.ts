import { AfterViewInit, Component, ElementRef, Input, ViewChild, HostListener } from '@angular/core';
import "./js/EnableThreeExamples";
import "three/examples/js/controls/OrbitControls";
import "three/examples/js/loaders/ColladaLoader";
import * as dat from './js/dat.gui.min';

declare var THREE;

@Component({
    selector: 'scene',
    templateUrl: './scene.component.html',
    styleUrls: ['./scene.component.css']
})
export class SceneComponent implements AfterViewInit {

    private renderer: THREE.WebGLRenderer;
    private camera: THREE.PerspectiveCamera;
    private cameraTarget: THREE.Vector3;
    public scene: THREE.Scene;

    public mesh: THREE.Mesh;
    public cube: THREE.Mesh;

    public fieldOfView: number = 60;
    public nearClippingPane: number = 1;
    public farClippingPane: number = 4000;

    public controls: THREE.OrbitControls;

    public geometry: THREE.PlaneGeometry;

    @ViewChild('canvas')
    private canvasRef: ElementRef;

    constructor() {
        this.render = this.render.bind(this);
        this.renderControls = this.renderControls.bind(this);
        //this.onModelLoadingCompleted = this.onModelLoadingCompleted.bind(this);
    }

    private get canvas(): HTMLCanvasElement {
        return this.canvasRef.nativeElement;
    }

    private createScene() {
        this.scene = new THREE.Scene();
        this.scene.add(new THREE.AxisHelper(200));
        //var loader = new THREE.ColladaLoader();
        //loader.load('assets/model/multimaterial.dae', this.onModelLoadingCompleted);
    }
    /*
    private onModelLoadingCompleted(collada) {
        var modelScene = collada.scene;
        this.scene.add(modelScene);
        this.render();
    }
    */
    private createLight() {
        var light = new THREE.PointLight(0xffffff, 1, 1000);
        light.position.set(0, 1000, 1000);
        this.scene.add(light);

        var light = new THREE.PointLight(0xffffff, 1, 1000);
        light.position.set(0, 1000, -1000);
        this.scene.add(light);
    }

    private createCamera() {
        this.camera = new THREE.PerspectiveCamera(55.0, window.innerWidth / window.innerHeight, 0.5, 300000);
        this.camera.position.set(45, 35, 45);
        this.camera.lookAt(new THREE.Vector3());
/*
        let aspectRatio = this.getAspectRatio();
        this.camera = new THREE.PerspectiveCamera(
            this.fieldOfView,
            aspectRatio,
            this.nearClippingPane,
            this.farClippingPane
        );

        // Set position and look at
        this.camera.position.x = 1500;
        this.camera.position.y = 1000;
        this.camera.position.z = 1500;

        this.camera.lookAt(new THREE.Vector3(0,0,0));*/
    }

    private createSquare(x,y,z) {
        let squareGeometry = new THREE.Geometry();
        squareGeometry.vertices.push(new THREE.Vector3(10*x, 0.0, 10*z)); 
        squareGeometry.vertices.push(new THREE.Vector3(10*(x+1), 0.0, 10*z)); 
        squareGeometry.vertices.push(new THREE.Vector3(10*(x+1), 0.0, 10*(z-1))); 
        squareGeometry.vertices.push(new THREE.Vector3(10*x, 0.0, 10*(z-1)));
        squareGeometry.faces.push(new THREE.Face3(0, 1, 2)); 
        squareGeometry.faces.push(new THREE.Face3(0, 3, 2));
        squareGeometry.faceVertexUvs[ 0 ].push( [
            new THREE.Vector2( 0, 0 ),
            new THREE.Vector2( 0, 1 ),
            new THREE.Vector2( 1, 1 ),
            new THREE.Vector2( 1, 0 )
        ] );

        let material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(0xff0000),
            side: THREE.DoubleSide, 
            wireframe: true});
        this.mesh = new THREE.Mesh( squareGeometry, material );
        this.scene.add(this.mesh);
    }

    private createMeshInSquares() {
        
        for(let x= -10; x < 10; x++) {
            for(let z= 10; z > -10; z--) {
                this.createSquare(x,0,z);
            }
        }

        /*
        var geom = new THREE.Geometry(); 
        var v1 = new THREE.Vector3(-500,0,-500);
        var v2 = new THREE.Vector3(-500,0,500);
        var v3 = new THREE.Vector3(500,0,500);
        var v4 = new THREE.Vector3(500,0,500);

        geom.vertices.push(v1);
        geom.vertices.push(v2);
        geom.vertices.push(v3);
        geom.vertices.push(v4);

        geom.faces.push( new THREE.Face3( 0, 1, 2 ) );
        geom.faces.push( new THREE.Face3( 2, 3, 0 ) );

        this.mesh = new THREE.Mesh( geom, new THREE.MeshNormalMaterial() );
        this.scene.add(this.mesh);
        */
    }

    private createCube() {
        let geometry = new THREE.BoxBufferGeometry(700, 700, 700, 10, 10, 10);
        let material = new THREE.MeshBasicMaterial({color: 0x2121ce, vertexColors: 0x2121ce, wireframe: true/*, lights: true*/});
        this.cube = new THREE.Mesh(geometry, material);
        this.cube.rotation.x = Math.PI / 2;
        this.scene.add(this.cube);

    }

    private createMesh() {
        //var geometry = new THREE.BoxBufferGeometry(700, 700, 700, 10, 10, 10);
        this.geometry = new THREE.PlaneGeometry(2000, 2000, 10, 10);
        let material = new THREE.MeshBasicMaterial({color: 0x2121ce, vertexColors: 0x2121ce, wireframe: true/*, lights: true*/});
        this.cube = new THREE.Mesh(this.geometry, material);
        this.cube.rotation.x = Math.PI / 2;
        this.scene.add(this.cube);

    }

    private getAspectRatio(): number {
        let height = this.canvas.clientHeight;
        if (height === 0) {
            return 0;
        }
        return this.canvas.clientWidth / this.canvas.clientHeight;
    }

    private startRendering() {
        /*
        this.renderer = new THREE.WebGLRenderer({canvas: this.canvas});
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.context.getExtension('OES_texture_float');
        this.renderer.context.getExtension('OES_texture_float_linear');
        */
        
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
        });
        this.renderer.setPixelRatio(devicePixelRatio);
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);

        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x000000, 1);
        this.renderer.autoClear = true;
        /*
        let component: SceneComponent = this;

        (function render() {
            component.render();
        }());
        */
       this.render();
    }

    animate() {
        requestAnimationFrame( this.animate );
        this.renderer.render( this.scene, this.camera );
    }

    makeModifications(component: SceneComponent) {
        let vertices = component.geometry.vertices;
        //console.log(vertices.length);
        for(let i = 0; i <vertices.length; i++) {
            vertices[i].z = Math.random()*100;
            //console.log(vertices[i]);
        }
        component.geometry.verticesNeedUpdate = true;

        component.geometry.computeVertexNormals();
    }

    public render() {
        console.log("render");

        //this.makeModifications(this);

        this.renderer.render(this.scene, this.camera);

        //this.renderer.renderLists.dispose();

        setTimeout(() => {
            requestAnimationFrame(this.render)
        }, 300);

    }

    renderControls() {
        this.renderer.render( this.scene, this.camera );
    }

    public addControls() {
        this.controls = new THREE.OrbitControls(this.camera);
        this.controls.rotateSpeed = 1.0;
        this.controls.zoomSpeed = 1.2;
        this.controls.addEventListener('change', this.renderControls);

    }

    /* EVENTS */

    public onMouseMove(event: MouseEvent) {
        console.log("onMouse");
    }


    public onMouseDown(event: MouseEvent) {
        console.log("onMouseDown");
        event.preventDefault();

        // Example of mesh selection/pick:
        var raycaster = new THREE.Raycaster();
        var mouse = new THREE.Vector2();
        mouse.x = (event.clientX / this.renderer.domElement.clientWidth) * 2 - 1;
        mouse.y = - (event.clientY / this.renderer.domElement.clientHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, this.camera);

        var obj: THREE.Object3D[] = [];
        this.findAllObjects(obj, this.scene);
        var intersects = raycaster.intersectObjects(obj);
        console.log("Scene has " + obj.length + " objects");
        console.log(intersects.length + " intersected objects found")
        intersects.forEach((i) => {
            console.log(i.object); // do what you want to do with object
            i.object.position.y = i.object.position.y + 1;
        });
        this.renderControls();
    }

    private findAllObjects(pred: THREE.Object3D[], parent: THREE.Object3D) {
        // NOTE: Better to keep separate array of selected objects
        if (parent.children.length > 0) {
            parent.children.forEach((i) => {
                pred.push(i);
                this.findAllObjects(pred, i);                
            });
        }
    }

    public onMouseUp(event: MouseEvent) {
        console.log("onMouseUp");
    }


    @HostListener('window:resize', ['$event'])
    public onResize(event: Event) {
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";
        console.log("onResize: " + this.canvas.clientWidth + ", " + this.canvas.clientHeight);

        this.camera.aspect = this.getAspectRatio();
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderControls();
    }

    @HostListener('document:keypress', ['$event'])
    public onKeyPress(event: KeyboardEvent) {
        console.log("onKeyPress: " + event.key);
    }

    /* LIFECYCLE */
    ngAfterViewInit() {
        this.createScene();
        this.createMeshInSquares();
        //funciona
        //this.createMesh();
        //no es veu
        //this.createCube();
        this.createLight();
        this.createCamera();
        this.startRendering();
        this.addControls();
        
        //this.animate();
    }

}
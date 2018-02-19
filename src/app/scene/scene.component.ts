import { AfterViewInit, Component, ElementRef, Input, ViewChild, HostListener } from '@angular/core';
import * as THREE from 'three';
import "./js/EnableThreeExamples";
import "three/examples/js/controls/OrbitControls";
import "three/examples/js/loaders/ColladaLoader";

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

    public fieldOfView: number = 60;
    public nearClippingPane: number = 1;
    public farClippingPane: number = 1100;

    public controls: THREE.OrbitControls;

    @ViewChild('canvas')
    private canvasRef: ElementRef;

    constructor() {
        this.render = this.render.bind(this);
        this.onModelLoadingCompleted = this.onModelLoadingCompleted.bind(this);
    }

    private get canvas(): HTMLCanvasElement {
        return this.canvasRef.nativeElement;
    }

    private createScene() {
        this.scene = new THREE.Scene();
        this.scene.add(new THREE.AxisHelper(200));
        var loader = new THREE.ColladaLoader();
        loader.load('assets/model/multimaterial.dae', this.onModelLoadingCompleted);
    }

    private onModelLoadingCompleted(collada) {
        var modelScene = collada.scene;
        this.scene.add(modelScene);
        this.render();
    }

    private createLight() {
        var light = new THREE.PointLight(0xffffff, 1, 1000);
        light.position.set(0, 0, 100);
        this.scene.add(light);

        var light = new THREE.PointLight(0xffffff, 1, 1000);
        light.position.set(0, 0, -100);
        this.scene.add(light);
    }

    private createCamera() {
        let aspectRatio = this.getAspectRatio();
        this.camera = new THREE.PerspectiveCamera(
            this.fieldOfView,
            aspectRatio,
            this.nearClippingPane,
            this.farClippingPane
        );

        // Set position and look at
        this.camera.position.x = 10;
        this.camera.position.y = 10;
        this.camera.position.z = 100;
    }

    private createSquare(x,y,z) {
        let squareGeometry = new THREE.Geometry();
        squareGeometry.vertices.push(new THREE.Vector3(10*x, 0.0, 10*z)); 
        squareGeometry.vertices.push(new THREE.Vector3(10*(x+1), 0.0, 10*z)); 
        squareGeometry.vertices.push(new THREE.Vector3(10*(x+1), 0.0, 10*(z-1))); 
        squareGeometry.vertices.push(new THREE.Vector3(10*x, 0.0, 10*(z-1)));
        squareGeometry.faces.push(new THREE.Face3(0, 1, 2)); 
        squareGeometry.faces.push(new THREE.Face3(0, 3, 2));

        let material = new THREE.MeshBasicMaterial({color: 0x999999, side: THREE.DoubleSide, wireframe: true});
        this.mesh = new THREE.Mesh( squareGeometry, material );
        this.scene.add(this.mesh);
    }

    private createMesh() {
        
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

    private getAspectRatio(): number {
        let height = this.canvas.clientHeight;
        if (height === 0) {
            return 0;
        }
        return this.canvas.clientWidth / this.canvas.clientHeight;
    }

    private startRendering() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true
        });
        this.renderer.setPixelRatio(devicePixelRatio);
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);

        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0xffffff, 1);
        this.renderer.autoClear = true;

        let component: SceneComponent = this;

        (function render() {
            //requestAnimationFrame(render);
            component.render();
        }());
    }

    public render() {
        this.renderer.render(this.scene, this.camera);
    }

    public addControls() {
        this.controls = new THREE.OrbitControls(this.camera);
        this.controls.rotateSpeed = 1.0;
        this.controls.zoomSpeed = 1.2;
        this.controls.addEventListener('change', this.render);

    }

    /* EVENTS */

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
        });

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
        this.render();
    }

    @HostListener('document:keypress', ['$event'])
    public onKeyPress(event: KeyboardEvent) {
        console.log("onKeyPress: " + event.key);
    }

    /* LIFECYCLE */
    ngAfterViewInit() {
        this.createScene();
        this.createMesh();
        this.createLight();
        this.createCamera();
        this.startRendering();
        this.addControls();
    }

}
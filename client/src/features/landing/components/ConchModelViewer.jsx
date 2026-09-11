import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const CAMERA_POSITION = [0, 0, 44];
const MODEL_WIDTH_FILL = 0.5;
const MODEL_HEIGHT_FILL = 0.42;

export default function ConchModelViewer({ className = "" }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) {
      return undefined;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    const timer = new THREE.Timer();
    const controls = new OrbitControls(camera, renderer.domElement);
    const targetRotation = { x: 0, y: 0 };

    camera.position.set(...CAMERA_POSITION);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.rotateSpeed = 0.35;
    controls.minPolarAngle = Math.PI / 2 - 0.35;
    controls.maxPolarAngle = Math.PI / 2 + 0.35;

    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 3.2);
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    const rimLight = new THREE.DirectionalLight(0xffffff, 1.8);

    keyLight.position.set(-7, 18, 12);
    rimLight.position.set(8, -6, 14);
    scene.add(ambientLight, keyLight, rimLight);

    let frameId = 0;
    let isDisposed = false;
    let modelPivot = null;

    const resize = () => {
      const width = mount.clientWidth || 1;
      const height = mount.clientHeight || 1;

      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const loader = new GLTFLoader();
    loader.load(
      "/conch.glb",
      (gltf) => {
        if (isDisposed) {
          return;
        }

        const model = gltf.scene;
        modelPivot = new THREE.Group();
        const mirrorRoot = new THREE.Group();
        const bounds = new THREE.Box3().setFromObject(model);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());

        const whiteMaterial = new THREE.MeshBasicMaterial({
          color: "#ffffff",
          side: THREE.DoubleSide,
        });

        model.traverse((object) => {
          if (!object.isMesh) {
            return;
          }

          object.material = whiteMaterial;
        });

        model.position.sub(center);

        if (size.x > 0 && size.y > 0) {
          const visibleHeight =
            2 * CAMERA_POSITION[2] * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
          const visibleWidth = visibleHeight * camera.aspect;
          const scale = Math.min(
            (visibleWidth * MODEL_WIDTH_FILL) / size.x,
            (visibleHeight * MODEL_HEIGHT_FILL) / size.y,
          );

          model.scale.setScalar(scale);
        }

        mirrorRoot.scale.x = -1;
        mirrorRoot.add(model);
        modelPivot.add(mirrorRoot);
        modelPivot.updateMatrixWorld(true);

        const fittedBounds = new THREE.Box3().setFromObject(modelPivot);
        const fittedCenter = fittedBounds.getCenter(new THREE.Vector3());

        mirrorRoot.position.sub(fittedCenter);
        scene.add(modelPivot);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
      },
      undefined,
      (error) => {
        console.error("Failed to load /conch.glb", error);
      },
    );

    const handlePointerMove = (event) => {
      const bounds = mount.getBoundingClientRect();
      const pointerX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      const pointerY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;

      targetRotation.y = pointerX * 0.16;
      targetRotation.x = -pointerY * 0.08;
    };

    const handlePointerLeave = () => {
      targetRotation.x = 0;
      targetRotation.y = 0;
    };

    const animate = () => {
      frameId = window.requestAnimationFrame(animate);
      timer.update();
      timer.getDelta();

      if (modelPivot) {
        modelPivot.rotation.x += (targetRotation.x - modelPivot.rotation.x) * 0.08;
        modelPivot.rotation.y += (targetRotation.y - modelPivot.rotation.y) * 0.08;
      }

      controls.update();
      renderer.render(scene, camera);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    mount.addEventListener("pointermove", handlePointerMove);
    mount.addEventListener("pointerleave", handlePointerLeave);
    resize();
    animate();

    return () => {
      isDisposed = true;
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      mount.removeEventListener("pointermove", handlePointerMove);
      mount.removeEventListener("pointerleave", handlePointerLeave);
      controls.dispose();
      renderer.dispose();

      scene.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose();
        }

        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });

      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div className={className} ref={mountRef} aria-hidden="true" />;
}

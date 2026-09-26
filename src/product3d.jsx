import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildMenuModel } from "./menu-models.js";

function arFailureMessage(error) {
  if (["NotAllowedError", "SecurityError"].includes(error?.name))
    return "AR access was denied. Allow camera access and try again.";
  if (error?.name === "NotSupportedError")
    return "This browser cannot start surface-tracked AR. Use the 3D preview instead.";
  return "AR could not start. Please try again or use the 3D preview.";
}

export default function Product3D({ productId, productName }) {
  const mount = useRef(null);
  const viewer = useRef(null);
  const [error, setError] = useState("");
  const [arSupport, setArSupport] = useState("checking");
  const [arError, setArError] = useState("");
  const [arActive, setArActive] = useState(false);
  const [arStarting, setArStarting] = useState(false);

  useEffect(() => {
    const host = mount.current;
    let renderer, controls, observer, session, hitSource, overlay;
    let starting = false;
    let alive = true;
    const scene = new THREE.Scene();
    const model = new THREE.Group();
    scene.add(model);
    const reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.07, 0.09, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x174f43, side: THREE.DoubleSide }),
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    const stopAR = () => {
      try {
        hitSource?.cancel();
      } catch {}
      hitSource = null;
      overlay?.remove();
      overlay = null;
      session = null;
      reticle.visible = false;
      model.visible = true;
      model.position.set(0, 0, 0);
      model.scale.setScalar(1);
      if (controls) controls.enabled = true;
      if (alive) setArActive(false);
    };

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !window.matchMedia("(pointer: coarse)").matches,
        alpha: true,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.xr.enabled = true;
      renderer.setClearColor(0x000000, 0);
      host.appendChild(renderer.domElement);
      renderer.domElement.setAttribute(
        "aria-label",
        `Interactive 3D preview of ${productName}`,
      );
      const onContextLost = (event) => {
        event.preventDefault();
        session?.end().catch(() => {});
        renderer.setAnimationLoop(null);
        if (alive)
          setError(
            "3D graphics stopped on this device. Close this item and try again.",
          );
      };
      renderer.domElement.addEventListener("webglcontextlost", onContextLost);
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      camera.position.set(3, 2.7, 4);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 0.75, 0);
      controls.enableDamping = true;
      controls.enablePan = false;
      controls.minDistance = 2.5;
      controls.maxDistance = 7;
      controls.maxPolarAngle = Math.PI * 0.48;
      scene.add(new THREE.HemisphereLight(0xffffff, 0x718069, 3));
      const light = new THREE.DirectionalLight(0xfff1dd, 4);
      light.position.set(3, 5, 3);
      scene.add(light);
      buildMenuModel(model, productId);

      const resize = () => {
        const width = host.clientWidth;
        if (!width) return;
        renderer.setSize(width, 290);
        camera.aspect = width / 290;
        camera.updateProjectionMatrix();
      };
      observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();

      renderer.setAnimationLoop((_, frame) => {
        try {
          if (frame && hitSource) {
            const referenceSpace = renderer.xr.getReferenceSpace();
            if (referenceSpace) {
              const hits = frame.getHitTestResults(hitSource);
              const pose = hits[0]?.getPose(referenceSpace);
              reticle.visible = Boolean(pose);
              if (pose) reticle.matrix.fromArray(pose.transform.matrix);
            }
          }
          if (!renderer.xr.isPresenting) controls.update();
          renderer.render(scene, camera);
        } catch {
          renderer.setAnimationLoop(null);
          session?.end().catch(() => {});
          if (alive)
            setArError("AR tracking stopped. Close the preview and try again.");
        }
      });

      viewer.current = {
        reset() {
          camera.position.set(3, 2.7, 4);
          controls.target.set(0, 0.75, 0);
          controls.update();
        },
        async startAR() {
          if (starting || session) return;
          starting = true;
          if (alive) setArStarting(true);
          setArError("");
          overlay = document.createElement("div");
          overlay.className = "ar-overlay";
          const hint = document.createElement("p");
          hint.textContent =
            "Move your phone to find a surface, then tap to place the item.";
          overlay.appendChild(hint);
          const exit = document.createElement("button");
          exit.type = "button";
          exit.textContent = "Exit AR";
          exit.addEventListener("click", () => session?.end());
          overlay.appendChild(exit);
          overlay.addEventListener("beforexrselect", (event) =>
            event.preventDefault(),
          );
          document.body.appendChild(overlay);
          try {
            // requestSession stays directly in the click handler so browsers
            // retain the user gesture required to open the camera.
            session = await navigator.xr.requestSession("immersive-ar", {
              requiredFeatures: ["hit-test"],
              optionalFeatures: ["dom-overlay"],
              domOverlay: { root: overlay },
            });
            if (!alive) {
              await session.end();
              return;
            }
            session.addEventListener("end", stopAR, { once: true });
            session.addEventListener("select", () => {
              if (!reticle.visible) return;
              model.position.setFromMatrixPosition(reticle.matrix);
              model.visible = true;
            });
            controls.enabled = false;
            model.visible = false;
            model.scale.setScalar(0.12);
            renderer.xr.setReferenceSpaceType("local");
            await renderer.xr.setSession(session);
            const viewerSpace = await session.requestReferenceSpace("viewer");
            hitSource = await session.requestHitTestSource({
              space: viewerSpace,
            });
            if (alive) setArActive(true);
          } catch (cause) {
            if (session) await session.end().catch(() => {});
            stopAR();
            if (alive) setArError(arFailureMessage(cause));
          } finally {
            starting = false;
            if (alive) setArStarting(false);
          }
        },
        endAR() {
          session?.end();
        },
      };

      if (!window.isSecureContext || !navigator.xr?.isSessionSupported) {
        setArSupport("unsupported");
      } else {
        navigator.xr
          .isSessionSupported("immersive-ar")
          .then(
            (supported) =>
              alive && setArSupport(supported ? "supported" : "unsupported"),
          )
          .catch(() => alive && setArSupport("unsupported"));
      }
    } catch {
      setError(
        "3D isn’t supported on this device. Use the photo preview instead.",
      );
      setArSupport("unsupported");
    }

    return () => {
      alive = false;
      overlay?.remove();
      renderer?.setAnimationLoop(null);
      observer?.disconnect();
      controls?.dispose();
      viewer.current = null;
      const activeSession = session;
      void (async () => {
        if (activeSession) await activeSession.end().catch(() => {});
        try {
          hitSource?.cancel();
        } catch {}
        scene.traverse((object) => {
          object.geometry?.dispose();
          if (object.material)
            for (const surface of [object.material].flat()) surface.dispose();
        });
        renderer?.dispose();
        renderer?.domElement.remove();
      })();
    };
  }, [productId, productName]);

  return (
    <div className="product-3d">
      <div ref={mount} className="model-canvas" />
      {error ? (
        <p role="status">{error}</p>
      ) : (
        <>
          <div className="model-controls">
            <span>Drag to rotate · pinch to zoom</span>
            <button
              className="text-button"
              onClick={() => viewer.current?.reset()}
            >
              Reset view
            </button>
          </div>
          <button
            className="secondary ar-launch"
            disabled={arSupport !== "supported" || arActive || arStarting}
            onClick={() => viewer.current?.startAR()}
          >
            {arActive
              ? "AR is open"
              : arStarting
                ? "Starting AR…"
                : "View in your space (AR)"}
          </button>
          {arActive && (
            <button
              className="text-button"
              onClick={() => viewer.current?.endAR()}
            >
              Exit AR
            </button>
          )}
          {arSupport === "unsupported" && (
            <p>
              AR needs a compatible WebXR device and HTTPS. You can still
              explore the 3D model here.
            </p>
          )}
          {arError && <p role="status">{arError}</p>}
          <p>Illustrative model · actual presentation and portion may vary.</p>
        </>
      )}
    </div>
  );
}

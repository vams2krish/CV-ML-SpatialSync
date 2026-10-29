# Prototype data formats

All imports are JSON. File size limit: 30 MB. Invalid input is reported without replacing the existing map. No inferred camera poses or generated depth are silently substituted for missing sensor measurements.

## Metric point cloud

```json
{
  "units": "meters",
  "source": "imported",
  "points": [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
  "landmarks": [[0, 0, 0], [1, 0, 0], [0, 1, 0]]
}
```

`points` contains 1–100,000 finite XYZ triples with absolute values at most 10,000 m. Viewer world convention: +Y up. Landmark index `i` in cloud B must correspond to index `i` in cloud A. Supply 3–1,000 pairs with at least two independent spatial directions. Non-collinear planar pairs are valid; collinear pairs are rejected. Imported source metadata is not independently verified.

The Kabsch solver estimates a proper rigid rotation and translation from all supplied pairs; it rejects fits above the user-selected landmark RMSE threshold. It does not search for correspondences, reject individual outliers, or estimate scale. A low landmark residual does not guarantee that the rest of the environment overlaps. Never submit arbitrary correspondences and interpret the result as a verified whole-scene reconstruction.

## Posed-depth recording

```json
{
  "schemaVersion": 1,
  "units": "meters",
  "intrinsics": {"width": 2, "height": 2, "fx": 1, "fy": 1, "cx": 0, "cy": 0},
  "frames": [{
    "timestampMs": 0,
    "depth": [1, 1, 1, 1],
    "cameraToWorld": [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
  }]
}
```

Intrinsics refer to the depth image dimensions, with focal lengths and principal point in pixels. Distortion must already be corrected. The depth buffer is row-major; each value is **camera-axis Z distance in meters**, not Euclidean ray range. Zero / null means invalid. Other values must be positive and at most 50 m. The sample limit is 100,000 pixels per frame, 100 frames, and one million valid unprojected samples overall.

For pixel `(u,v)` with depth `z`, `p_camera = [(u-cx)z/fx, (v-cy)z/fy, z]`. Camera axes: +X right, +Y down, +Z forward. `cameraToWorld` is a finite row-major 4×4 rigid transform with a proper orthonormal rotation and bottom row `[0,0,0,1]`. Translation is in meters. Supply poses that map into the desired +Y-up world. The identity pose preserves camera axes and therefore does not turn a camera-down frame into a world-up frame.

Timestamps must be finite and non-decreasing. The import uses provided poses directly; it neither estimates poses nor synchronizes separate clocks. Output points are voxel-filtered at 4 cm using cell centroids. No color fusion, meshing, confidence filtering, or loop closure is performed. The example in this repository is synthetic.

## RGB capture

The browser exports a v1 `kind: "rgb-capture"` object containing `createdAt`, exported `width` / `height`, optional manually entered `intrinsics`, a sampling-clock description, `sampleIntervalMs: 500`, and `frames` with `timestampMs` / JPEG data URLs. `depth`, `imu`, and `poses` are null. Samples are resized to a maximum width of 640 pixels and JPEG quality 0.65. Capture stops at 180 frames; browser scheduling may lower the actual sample rate.

Timestamps record the browser sampling moment relative to recording start; they are not exposure times, decoded-frame presentation timestamps, or a cross-device clock. The camera is stopped after recording. Replay schedules frames according to their stored timestamp differences and supports manual scrubbing. Long pauses remain pauses during replay. The optional intrinsics must match the exported dimensions; the app validates numeric fields but cannot verify calibration accuracy.

Files are kept in memory and saved only on explicit download. Frame imports accept at most 180 JPEG data URLs of 500,000 characters each, within the file-size limit. Recordings are not automatically stored or uploaded. Treat saved files as sensitive camera recordings.

## Local shared-session protocol

Connect to `ws://127.0.0.1:8787/?room=<32 lowercase hex characters>`. The client generates the session key using the browser cryptographic RNG.

- Server → client: `{ "type": "snapshot", "revision": 0, "cloud": null }` initially; later snapshots include a validated metric cloud.
- Client → server: `{ "type": "publish", "baseRevision": 0, "cloud": { "units": "meters", "points": [[1,2,3]], "source": "imported" } }`.
- Accepted publish: increment the revision and broadcast a snapshot to every peer, including the publisher.
- Stale publish: return the current snapshot, followed by an error. The local client restores the shared state; this is a full-map replacement workflow.
- Invalid input: send `{ "type": "error", "message": "..." }` without changing the revision.

Limits: 32 active / retained rooms, eight clients per room, 8 MB message payload, at most two publish attempts per second per client. An empty room remains available for ten minutes before expiry. Process restart clears all rooms. Map geometry, not raw RGB captures, is transmitted. This protocol provides revision consistency, not spatial registration, automatic fusion, distributed consensus, or production authorization.

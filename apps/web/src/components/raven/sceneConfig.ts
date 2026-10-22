/**
 * The old reference camera (3/4 view, 1:1 frame, vertical fov). Only used to bake the reference's surface detail onto the case
 * (UVs); nothing in the live scene looks through it.
 */
export const CAMERA = { position: [7.2, 2.7, 10.0] as const, target: [0, 0.72, 0] as const, fov: 26 };

/**
 * The site camera: a wide frame (about 2.2 : 1), the case seen from slightly right of its front and a little above, standing on
 * a marble platform, so the long front with the raven reads fully and the end with the handle is foreshortened.
 */
export const VIEW = { position: [3.2, 3.0, 13.4] as const, target: [-0.55, 1.75, 0.3] as const, fov: 24 };

/**
 * Oil Sheen surface shader for OilGuard M6 Welcome Experience.
 * Restrained thin-film iridescence:
 * Dark petroleum hues (#06090D, #111A24, bronze/petroleum tint),
 * subtle angle-dependent reflection, physically integrated look (NO neon rainbow).
 * Fully adjustable opacity for scroll-driven revelation.
 */

export const sheenVertexShader = /* glsl */ `
uniform float uTime;
varying vec3 vWorldPosition;
varying vec2 vUv;
varying vec3 vNormal;

void main() {
  vUv = uv;
  vec3 pos = position;

  // Gentle organic undulating edge
  float wave = sin(pos.x * 0.4 + uTime * 0.8) * cos(pos.z * 0.3 + uTime * 0.6) * 0.08;
  pos.y += wave;

  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorldPosition = worldPos.xyz;
  vNormal = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const sheenFragmentShader = /* glsl */ `
uniform float uOpacity;
uniform float uTime;
uniform vec3 uColorPetroleum; // Deep hydrocarbon base #060A0E
uniform vec3 uColorSheen;     // Metallic bronze-slate sheen #1C2735
uniform vec3 uColorGlance;    // Muted oil iridescent tint #283C4D
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;

varying vec3 vWorldPosition;
varying vec2 vUv;
varying vec3 vNormal;

// Simplex-like noise helper for organic boundary distortion
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  if (uOpacity <= 0.001) {
    discard;
  }

  vec2 center = vUv - vec2(0.5);
  // Elliptical plume geometry trailing behind vessel
  float dist = length(center * vec2(1.0, 0.45));

  // Organic boundary turbulence
  float n = noise(vUv * 8.0 + vec2(uTime * 0.1, uTime * 0.05));
  float edgeDist = dist + (n - 0.5) * 0.18;

  // Soft falloff from core to boundary
  float plumeAlpha = 1.0 - smoothstep(0.15, 0.48, edgeDist);
  if (plumeAlpha <= 0.01) {
    discard;
  }

  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float cosTheta = max(dot(viewDir, vNormal), 0.0);

  // Thin-film interference simulation (restrained, dark maritime palette)
  // Low angle gives subtle bronze-indigo metallic gloss
  float glance = pow(1.0 - cosTheta, 3.0);
  float interference = sin(dist * 28.0 - cosTheta * 6.0 + uTime * 0.3) * 0.5 + 0.5;

  vec3 filmColor = mix(uColorPetroleum, uColorSheen, interference * 0.65);
  filmColor = mix(filmColor, uColorGlance, glance * 0.8);

  // Subtle interior slick banding (indicates variable slick thickness)
  float thicknessBands = sin(dist * 45.0 + n * 4.0) * 0.5 + 0.5;
  filmColor += vec3(0.02, 0.035, 0.05) * thicknessBands * 0.3;

  float finalAlpha = plumeAlpha * uOpacity * 0.88;

  // Atmospheric fog
  float camDist = length(vWorldPosition - cameraPosition);
  float fogFactor = smoothstep(uFogNear, uFogFar, camDist);
  filmColor = mix(filmColor, uFogColor, fogFactor);

  gl_FragColor = vec4(filmColor, finalAlpha);
}
`;

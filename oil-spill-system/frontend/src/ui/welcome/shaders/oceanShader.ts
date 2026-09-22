/**
 * Ocean surface shaders for OilGuard M6 Welcome Experience.
 * "Instrument at Sea" aesthetic:
 * Vast dark ocean, deep abyss tones (#070B10, #0B1118), subtle Gerstner waves,
 * Fresnel reflection, and atmospheric depth fog.
 */

export const oceanVertexShader = /* glsl */ `
uniform float uTime;
uniform float uWaveHeight;
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vElevation;

// Gerstner wave function
// Displaces x, z toward crest and y upward
vec3 gerstnerWave(vec2 dir, float steepness, float wavelength, vec2 position, float time, inout vec3 tangent, inout vec3 binormal) {
  float k = 2.0 * 3.14159265 / wavelength;
  float c = sqrt(9.8 / k);
  vec2 d = normalize(dir);
  float f = k * (dot(d, position) - c * time * 0.4);
  float a = steepness / k;

  tangent += vec3(
    -d.x * d.x * (steepness * sin(f)),
    d.x * (steepness * cos(f)),
    -d.x * d.y * (steepness * sin(f))
  );

  binormal += vec3(
    -d.x * d.y * (steepness * sin(f)),
    d.y * (steepness * cos(f)),
    -d.y * d.y * (steepness * sin(f))
  );

  return vec3(
    d.x * (a * cos(f)),
    a * sin(f),
    d.y * (a * cos(f))
  );
}

void main() {
  vUv = uv;
  vec3 pos = position;

  vec3 tangent = vec3(1.0, 0.0, 0.0);
  vec3 binormal = vec3(0.0, 0.0, 1.0);

  // 3 restrained wave components
  float time = uTime;
  vec3 wave1 = gerstnerWave(vec2(1.0, 0.3), 0.12 * uWaveHeight, 35.0, pos.xz, time, tangent, binormal);
  vec3 wave2 = gerstnerWave(vec2(0.5, 0.8), 0.08 * uWaveHeight, 18.0, pos.xz, time * 1.1, tangent, binormal);
  vec3 wave3 = gerstnerWave(vec2(-0.4, 0.6), 0.04 * uWaveHeight, 9.0, pos.xz, time * 0.9, tangent, binormal);

  vec3 displaced = pos + wave1 + wave2 + wave3;
  vElevation = displaced.y;

  vec3 normal = normalize(cross(binormal, tangent));
  vNormal = normalMatrix * normal;

  vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
  vWorldPosition = worldPos.xyz;

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const oceanFragmentShader = /* glsl */ `
uniform vec3 uColorAbyss;     // #070B10 Deep ocean
uniform vec3 uColorTrench;    // #0B1118 Mid depth
uniform vec3 uColorCrest;     // #1A2634 Subtle wave crest
uniform vec3 uFogColor;       // #070B10 Atmosphere
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uLightDir;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vElevation;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);

  // Fresnel term for water surface reflectivity (Schlick's approximation)
  float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(viewDir, normal), 0.0), 4.0);

  // Diffuse illumination from moonlight / navigational searchlight
  float diffuse = max(dot(normal, normalize(uLightDir)), 0.0);

  // Base ocean color gradient from elevation and depth
  vec3 waterColor = mix(uColorAbyss, uColorTrench, smoothstep(-1.2, 0.8, vElevation));
  waterColor = mix(waterColor, uColorCrest, smoothstep(0.4, 1.4, vElevation) * 0.35);

  // Restrained celestial reflection / sky sheen
  vec3 skyGlint = vec3(0.12, 0.18, 0.24) * fresnel * (0.4 + 0.6 * diffuse);

  // Subtle specular glint
  vec3 halfVector = normalize(normalize(uLightDir) + viewDir);
  float specular = pow(max(dot(normal, halfVector), 0.0), 64.0) * 0.45;

  vec3 finalColor = waterColor + skyGlint + vec3(specular * 0.25);

  // Subtle graticule / nautical chartline trace on water surface (very faint)
  vec2 grid = abs(fract(vWorldPosition.xz * 0.05 - 0.5) - 0.5) / fwidth(vWorldPosition.xz * 0.05);
  float line = min(grid.x, grid.y);
  float gridMask = 1.0 - min(line, 1.0);
  finalColor += vec3(0.04, 0.07, 0.10) * gridMask * 0.15;

  // Atmospheric distance fog to blend horizon into void (#070B10)
  float dist = length(vWorldPosition - cameraPosition);
  float fogFactor = smoothstep(uFogNear, uFogFar, dist);
  finalColor = mix(finalColor, uFogColor, fogFactor);

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

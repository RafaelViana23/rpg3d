import {ShaderChunk} from 'three';

/** Keep every direct emitter, without expanding its full BRDF into shader source. */
export function configureDirectLightShader(){
  const marker='// city-direct-light-loop';
  const source=ShaderChunk.lights_fragment_begin;
  if(source.includes(marker))return;
  const start=source.indexOf('#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )');
  const end=source.indexOf('#if ( NUM_SPOT_LIGHTS > 0 )',start);
  if(start<0||end<0)throw new Error('Point-light shader section missing');
  const original=source.slice(start,end);
  ShaderChunk.lights_fragment_begin=source.slice(0,start)+`
${marker}
#if NUM_POINT_LIGHT_SHADOWS == 0
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
  for ( int cityLightIndex = 0; cityLightIndex < NUM_POINT_LIGHTS; cityLightIndex ++ ) {
    PointLight cityPointLight = pointLights[ cityLightIndex ];
    vec3 cityLightDelta = cityPointLight.position - geometryPosition;
    // Three's attenuation is exactly zero at and beyond the finite cutoff.
    // Skip normalization, attenuation and BRDF only where contribution is zero.
    if ( cityPointLight.distance > 0.0 && dot(cityLightDelta,cityLightDelta) >= cityPointLight.distance * cityPointLight.distance ) continue;
    if ( all(equal(cityPointLight.color,vec3(0.0))) ) continue;
    getPointLightInfo( cityPointLight, geometryPosition, directLight );
    RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
  }
#endif
#else
${original}
#endif
`+source.slice(end);
}

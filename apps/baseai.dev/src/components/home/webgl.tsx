'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import html2canvas from 'html2canvas';

const WebGLInitializer = () => {
	const mountRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(
			75,
			window.innerWidth / window.innerHeight,
			0.1,
			1000
		);
		const renderer = new THREE.WebGLRenderer({
			alpha: true,
			antialias: true
		});
		renderer.setSize(window.innerWidth, window.innerHeight);
		if (mountRef.current) {
			mountRef.current.appendChild(renderer.domElement);
		}

		const canvas = document.createElement('canvas');
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;

		const fontFace = new FontFace(
			'Grotesk',
			'url(/AlteHaasGroteskBold.ttf)'
		);
		document.fonts.add(fontFace);

		const style = document.createElement('style');
		style.innerHTML = `
			  @import url(/AlteHaasGroteskBold.ttf);
			  body {
			    font-family: 'Grotesk', sans-serif;
			  }
			`;
		document.head.appendChild(style);

		const textDiv = document.createElement('div');
		textDiv.style.position = 'absolute';
		textDiv.style.left = '0';
		textDiv.style.top = '0';
		textDiv.style.width = '100%';
		textDiv.style.height = '100%';
		textDiv.style.fontSize = `${window.innerWidth * 0.155}px`;
		textDiv.style.fontWeight = 'bold';
		textDiv.style.fontFamily = 'Grotesk, sans-serif';
		textDiv.style.color = 'rgba(255,255,255,1)';
		textDiv.style.display = 'flex';
		textDiv.style.justifyContent = 'center';
		textDiv.style.alignItems = 'center';
		textDiv.textContent = 'BASE AI';
		textDiv.style.zIndex = '-1';

		const PIXEL_RATIO = 2;
		const createHighResBackgroundTexture = async (
			width: number,
			height: number
		) => {
			const scale = PIXEL_RATIO;
			textDiv.style.width = `${width}px`;
			textDiv.style.height = `${height}px`;
			textDiv.style.fontSize = `${width * 0.209}px`;

			await document.fonts.ready;
			document.body.appendChild(textDiv);

			const canvas = await html2canvas(textDiv, {
				backgroundColor: '#000000',
				scale: scale,
				width: width,
				height: height,
				logging: false,
				foreignObjectRendering: true
				// useCORS: true
			});

			const texture = new THREE.CanvasTexture(canvas);
			texture.wrapS = THREE.RepeatWrapping;
			texture.wrapT = THREE.RepeatWrapping;
			return texture;
		};

		const createInitialTexture = async () => {
			const texture = await createHighResBackgroundTexture(
				window.innerWidth,
				window.innerHeight
			);
			scene.background = texture;
			if (material.uniforms && material.uniforms.u_background) {
				material.uniforms.u_background.value = texture;
			}
		};

		createInitialTexture();

		const geometry = new THREE.SphereGeometry(0.75, 256, 256);

		const textureLoader = new THREE.TextureLoader();
		const envMapSize = Math.max(window.innerWidth, window.innerHeight) * 2;
		const envMap = textureLoader.load(
			'https://raw.githubusercontent.com/LangbaseInc/docs-images/refs/heads/main/www/hero/water-optim.jpg',
			undefined,
			undefined,
			() => {
				envMap.mapping = THREE.EquirectangularReflectionMapping;
				envMap.colorSpace = THREE.SRGBColorSpace;
				envMap.repeat.set(envMapSize / 2048, envMapSize / 1024);
				envMap.wrapS = THREE.RepeatWrapping;
				envMap.wrapT = THREE.RepeatWrapping;
			}
		);

		// Custom shader material for the enhanced liquid wavy effect
		const material = new THREE.ShaderMaterial({
			transparent: true,
			uniforms: {
				u_time: { value: 0.0 },
				u_resolution: {
					value: new THREE.Vector2(
						window.innerWidth,
						window.innerHeight
					)
				},
				u_background: { value: null },
				u_viewVector: { value: camera.position },
				envMap: { value: envMap },
				roughness: { value: 0.0 },
				metalness: { value: 5 },
				color: { value: new THREE.Color(0x3366ff) },
				u_mouse: { value: new THREE.Vector3() },
				u_lightDirection: { value: new THREE.Vector3(0, 1, 1) }
			},
			vertexShader: `
    precision mediump float;
    varying vec3 vNormal;
    varying vec3 rNormal;
    varying vec3 vViewPosition;
    varying vec2 vUv;
    varying float vNoise;
    uniform float u_time;
    uniform vec3 u_mouse;

    //  Classic Perlin 3D Noise
    //  by Stefan Gustavson
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
    vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}

    float snoise(vec3 P){
        vec3 Pi0 = floor(P); // Integer part for indexing
        vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
        Pi0 = mod(Pi0, 289.0);
        Pi1 = mod(Pi1, 289.0);
        vec3 Pf0 = fract(P); // Fractional part for interpolation
        vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
        vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
        vec4 iy = vec4(Pi0.yy, Pi1.yy);
        vec4 iz0 = Pi0.zzzz;
        vec4 iz1 = Pi1.zzzz;

        vec4 ixy = permute(permute(ix) + iy);
        vec4 ixy0 = permute(ixy + iz0);
        vec4 ixy1 = permute(ixy + iz1);

        vec4 gx0 = ixy0 / 7.0;
        vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
        gx0 = fract(gx0);
        vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
        vec4 sz0 = step(gz0, vec4(0.0));
        gx0 -= sz0 * (step(0.0, gx0) - 0.5);
        gy0 -= sz0 * (step(0.0, gy0) - 0.5);

        vec4 gx1 = ixy1 / 7.0;
        vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
        gx1 = fract(gx1);
        vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
        vec4 sz1 = step(gz1, vec4(0.0));
        gx1 -= sz1 * (step(0.0, gx1) - 0.5);
        gy1 -= sz1 * (step(0.0, gy1) - 0.5);

        vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
        vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
        vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
        vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
        vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
        vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
        vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
        vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

        vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
        g000 *= norm0.x;
        g010 *= norm0.y;
        g100 *= norm0.z;
        g110 *= norm0.w;
        vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
        g001 *= norm1.x;
        g011 *= norm1.y;
        g101 *= norm1.z;
        g111 *= norm1.w;

        float n000 = dot(g000, Pf0);
        float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
        float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
        float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
        float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
        float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
        float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
        float n111 = dot(g111, Pf1);

        vec3 fade_xyz = fade(Pf0);
        vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
        vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
        float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
        return 2.2 * n_xyz;
    }

    void main() {
        vUv = uv;
        float noise = snoise(vec3(position * 3.0 + u_time * .35));
        vec3 newPos = position + normal * noise * 0.05;

        vNoise = noise;
        rNormal = normalize(normalMatrix * (normal + vec3(noise * .75)));
        vNormal = normalize(normalMatrix * (normal + vec3(noise * 0.2)));

        vec4 mvPosition = modelViewMatrix * vec4(newPos, 1.0);
        vViewPosition = -mvPosition.xyz;

        gl_Position = projectionMatrix * mvPosition;
    }
    `,
			fragmentShader: `
    precision mediump float;
    varying vec3 vNormal;
    varying vec3 rNormal;
    varying vec3 vViewPosition;
    varying vec2 vUv;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform sampler2D u_background;
    uniform vec3 color;
    uniform float roughness;
    uniform float metalness;
    uniform sampler2D envMap;
    varying float vNoise;
    uniform vec3 u_lightDirection;

    vec2 dirToEquirectangular(vec3 dir) {
        float phi = atan(dir.z, dir.x);
        float theta = acos(dir.y);
        return vec2(0.5 + phi / (2.0 * 3.1415926535), theta / 3.1415926535);
    }

    vec2 dirToOctahedralMapping(vec3 dir) {
        dir = normalize(dir);
        vec2 octahedralDir = -dir.xy;
        octahedralDir = octahedralDir * sqrt(dot(octahedralDir, octahedralDir));
        return octahedralDir * 0.5 + 0.5;
    }

    void main() {
        // Normalize the interpolated normal and view direction
        vec3 normal = normalize(vNormal);
        vec3 rectraction_normal = normalize(rNormal);
        vec3 viewDir = normalize(vViewPosition);

        // Refraction effect without noise
        float ior = 1.33;
        vec3 refracted = refract(-viewDir, rectraction_normal, 1.0 / ior);

        // Reflection calculations
        vec3 reflection = reflect(viewDir, normal);

        // Calculate UV coordinates for sampling the background
        vec2 uv = gl_FragCoord.xy / u_resolution;

        // Distort the UV based on the refraction without noise
        float distortionStrength = 0.05;
        uv += refracted.xy * distortionStrength;

        // Sample the background texture for refraction
        vec4 refractedColor = texture2D(u_background, uv);

        // Fresnel effect for edge highlighting and reflection
        float fresnelBase = 1.0 - dot(viewDir, normal);
        float fresnel = pow(fresnelBase, 1.0);

        // Calculate distance from the center of the sphere
        vec2 centeredPos = vec2(vViewPosition.x, vViewPosition.y) - vec2(0.0, 0.0);
        float distanceFromCenter = length(centeredPos);

        // Adjust reflection strength based on distance from center
        float reflectionStrength = smoothstep(0.0, 0.0, distanceFromCenter);

        // Sample reflection color from both the background and envMap
        vec2 reflectedUV = reflection.xy * 1.0 * reflectionStrength;

        // Use the scaled reflection to compute envMap UV coordinates
        vec2 reflectEnvCoord = dirToOctahedralMapping(reflection);
        vec4 reflectedColor = texture2D(envMap, vec2(reflectEnvCoord.x,reflectEnvCoord.y));

        // Enhance bright parts of the reflection
        float brightness = dot(reflectedColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        float shininess = 5.0;
        reflectedColor.rgb *= pow(brightness, shininess);

        // Sharpen and boost the reflection for more liquid-like appearance
        reflectedColor.rgb *= 5.0 * reflectionStrength;

        // Combine refraction and reflection based on Fresnel effect and distance from center
        vec3 finalColor = mix(refractedColor.rgb, reflectedColor.rgb, fresnel * .7 *  reflectionStrength);

        // Simple PBR lighting with enhanced purple specular
        float NdotL = max(dot(normal, u_lightDirection), 0.0);
        vec3 H = normalize(u_lightDirection + viewDir);
        float NdotH = max(dot(normal, H), 0.0);

        // Increase the specular power for a tighter, more visible highlight
        float specPower = 90.0;
        float spec = pow(NdotH, specPower);

        // Define a strong purple color for the specular highlight
        vec3 purpleSpec = vec3(0.1, 0.02, 0.3); // Bright purple

        // Increase the intensity of the specular highlight
        float specIntensity = 2.;

        // Add the purple specular highlight to the final color
        finalColor += purpleSpec * spec * specIntensity * NdotL;

        // Add white outline
        float edgeStrength = 1.0 - smoothstep(0.0, 0.1, dot(normal, viewDir));
        finalColor = mix(finalColor, vec3(1.0), edgeStrength * 0.1);

        // Dark highlights
        float normalizedDarkNoise = (vNoise + 1.0) * 0.5; // Normalize noise to 0-1 range
        float darkGradient = smoothstep(1.0, 0.0, normalizedDarkNoise); // Create a smooth gradient

        // Smooth highlight for dark
        float fresnelDark = smoothstep(0.0, 1.0, fresnel);
        float normalYDark = smoothstep(-1.0, -1.0, vNormal.y);
        float darkHighlightStrength = fresnelDark * normalYDark;

        // Base color (dark)
        vec3 baseDarkHighlightColor = vec3(0.0, 0.0, 0.0);

        // Highlight color (dark)
        vec3 darkHighlightColor = vec3(0., 0., 0.);

        // Mix base color with highlight
        vec3 mixedDarkHighlight = mix(reflectedColor.rgb, darkHighlightColor, darkGradient);
        finalColor = mix(finalColor, mixedDarkHighlight, darkHighlightStrength * 0.5);

        // White highlights
        float normalizedNoise = (vNoise + 1.0) * 0.5; // Normalize noise to 0-1 range

        // Create a strip-like highlight
        vec3 stripDirection = normalize(vec3(1.0, 1.0, 1.0)); // Adjust this vector to change the strip orientation
        float stripHighlight = dot(normal, stripDirection);
        stripHighlight = smoothstep(0.0, .2, stripHighlight); // Adjust these values to control the width of the strip

        // Combine strip highlight with noise
        float whiteGradient = smoothstep(0.2, 1., normalizedNoise * stripHighlight);

        // Calculate the dot product between the normal and light direction
        float NdotLL = max(dot(normal, u_lightDirection), 0.0);

        // Smooth highlight for white, incorporating light direction and strip effect
        float fresnelWhite = smoothstep(0.0, 1.0, fresnel);
        float normalYWhite = smoothstep(-0.2, 0.2, normal.y);
        float whiteHighlightStrength = fresnelWhite * normalYWhite * NdotLL * stripHighlight;

        // Base color (dark)
        vec3 baseDarkColor = vec3(0.25, 0.25, 0.25);

        // Highlight color (white)
        vec3 whiteHighlightColor = vec3(1., 1., 1.);

        // Mix base color with highlight
        vec3 mixedWhiteHighlight = mix(baseDarkColor, whiteHighlightColor, whiteGradient * NdotLL);
        finalColor = mix(finalColor, mixedWhiteHighlight, whiteHighlightStrength * .15);

        // Output the final color with alpha
        gl_FragColor = vec4(finalColor, 1.0);
    }
    `
		});

		// Create a mesh with the geometry and material
		const sphere = new THREE.Mesh(geometry, material);
		scene.add(sphere);

		sphere.rotateZ(3);

		function calculateCameraZ(screenWidth: number, screenHeight: number) {
			let cameraZ;

			// Breakpoints based on screen width and height
			if (screenWidth <= 768) {
				if (screen.availWidth < screen.availHeight) {
					cameraZ = 4.5;
				} else {
					cameraZ = 2;
				}
			} else if (screenWidth > 768 && screenWidth <= 1920) {
				if (screenHeight <= 1080) {
					cameraZ = 2; // Full HD screens (1920x1080)
				} else {
					cameraZ = 1.9; // Higher aspect ratio or larger height
				}
			} else if (screenWidth > 1920 && screenWidth <= 2440) {
				if (screenHeight <= 1080) {
					cameraZ = 1.75; // Wide screens with Full HD height
				} else {
					cameraZ = 1.65; // Taller screens with higher resolutions
				}
			} else if (screenWidth > 2440) {
				if (screenHeight <= 1440) {
					cameraZ = 1.5; // Ultra-wide or larger 2K displays
				} else {
					cameraZ = 1.4; // 4K and above
				}
			}

			return cameraZ;
		}

		// Get screen width and height
		const screenWidth = window.innerWidth;
		const screenHeight = window.innerHeight;

		// Calculate camera Z position based on breakpoints
		const cameraZ = calculateCameraZ(screenWidth, screenHeight);
		if (cameraZ) camera.position.z = cameraZ;

		// Raycaster setup
		const raycaster = new THREE.Raycaster();
		const mouse = new THREE.Vector2();

		// Animation loop
		const animate = () => {
			requestAnimationFrame(animate);
			material.uniforms.u_time.value += 0.02; // Update time for animation
			material.uniforms.u_viewVector.value = camera.position;

			// Update mouse position in the shader
			raycaster.setFromCamera(mouse, camera);
			const intersects = raycaster.intersectObject(sphere);
			if (intersects.length > 0) {
				material.uniforms.u_mouse.value = intersects[0].point;
			}

			renderer.render(scene, camera);
		};

		animate();

		const updateCameraPosition = () => {
			const screenWidth = window.innerWidth;
			const screenHeight = window.innerHeight;
			const cameraZ = calculateCameraZ(screenWidth, screenHeight);
			if (cameraZ) camera.position.z = cameraZ;
		};

		updateCameraPosition();

		const onWindowResize = () => {
			const width = window.innerWidth;
			const height = window.innerHeight;

			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			renderer.setSize(width, height);

			if (material.uniforms) {
				material.uniforms.u_resolution.value.set(width, height);
			}

			updateCameraPosition();

			// Update background texture with new dimensions
			createHighResBackgroundTexture(width, height).then(texture => {
				scene.background = texture;
				if (material.uniforms && material.uniforms.u_background) {
					material.uniforms.u_background.value = texture;
				}
			});
			createHighResBackgroundTexture(width, height).then(texture => {
				scene.background = texture;
				if (material.uniforms && material.uniforms.u_background) {
					material.uniforms.u_background.value = texture;
				}
			});
		};

		window.addEventListener('resize', onWindowResize);

		return () => {
			window.removeEventListener('resize', onWindowResize);
			if (mountRef.current) {
				mountRef.current.removeChild(renderer.domElement);
			}
		};
	}, []);

	return <div ref={mountRef} />;
};

export default WebGLInitializer;

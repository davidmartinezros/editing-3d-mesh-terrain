Ocean = function ( renderer, camera, scene, options ) {

	// flag used to trigger parameter changes
	this.changed = true;
	this.initial = true;

	// Assign required parameters as object properties
	this.oceanCamera = new THREE.OrthographicCamera(); //camera.clone();
	this.oceanCamera.position.z = 1;
	this.renderer = renderer;
	this.renderer.clearColor( 0xffffff );

	this.scene = new THREE.Scene();

	// Assign optional parameters as variables and object properties
	function optionalParameter( value, defaultValue ) {

		return value !== undefined ? value : defaultValue;

	}
	options = options || {};
	this.clearColor = optionalParameter( options.CLEAR_COLOR, [ 1.0, 1.0, 1.0, 0.0 ] );
	this.geometryOrigin = optionalParameter( options.GEOMETRY_ORIGIN, [ - 1000.0, - 1000.0 ] );
	this.sunDirectionX = optionalParameter( options.SUN_DIRECTION[ 0 ], - 1.0 );
	this.sunDirectionY = optionalParameter( options.SUN_DIRECTION[ 1 ], 1.0 );
	this.sunDirectionZ = optionalParameter( options.SUN_DIRECTION[ 2 ], 1.0 );
	this.oceanColor = optionalParameter( options.OCEAN_COLOR, new THREE.Vector3( 0.004, 0.016, 0.047 ) );
	this.skyColor = optionalParameter( options.SKY_COLOR, new THREE.Vector3( 3.2, 9.6, 12.8 ) );
	this.exposure = optionalParameter( options.EXPOSURE, 0.35 );
	this.geometryResolution = optionalParameter( options.GEOMETRY_RESOLUTION, 32 );
	this.geometrySize = optionalParameter( options.GEOMETRY_SIZE, 2000 );
	this.resolution = optionalParameter( options.RESOLUTION, 64 );
	this.floatSize = optionalParameter( options.SIZE_OF_FLOAT, 4 );
	this.windX = optionalParameter( options.INITIAL_WIND[ 0 ], 10.0 );
	this.windY = optionalParameter( options.INITIAL_WIND[ 1 ], 10.0 );
	this.size = optionalParameter( options.INITIAL_SIZE, 250.0 );
	this.choppiness = optionalParameter( options.INITIAL_CHOPPINESS, 1.5 );

	//
	this.matrixNeedsUpdate = false;

	// Setup framebuffer pipeline
	var renderTargetType = optionalParameter( options.USE_HALF_FLOAT, false ) ? THREE.HalfFloatType : THREE.FloatType;
	var LinearClampParams = {
		minFilter: THREE.LinearFilter,
		magFilter: THREE.LinearFilter,
		wrapS: THREE.ClampToEdgeWrapping,
		wrapT: THREE.ClampToEdgeWrapping,
		format: THREE.RGBAFormat,
		stencilBuffer: false,
		depthBuffer: false,
		premultiplyAlpha: false,
		type: renderTargetType
	};
	var NearestClampParams = {
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		wrapS: THREE.ClampToEdgeWrapping,
		wrapT: THREE.ClampToEdgeWrapping,
		format: THREE.RGBAFormat,
		stencilBuffer: false,
		depthBuffer: false,
		premultiplyAlpha: false,
		type: renderTargetType
	};
	var NearestRepeatParams = {
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		wrapS: THREE.RepeatWrapping,
		wrapT: THREE.RepeatWrapping,
		format: THREE.RGBAFormat,
		stencilBuffer: false,
		depthBuffer: false,
		premultiplyAlpha: false,
		type: renderTargetType
	};
	this.initialSpectrumFramebuffer = new THREE.WebGLRenderTarget( this.resolution, this.resolution, NearestRepeatParams );
	this.spectrumFramebuffer = new THREE.WebGLRenderTarget( this.resolution, this.resolution, NearestClampParams );
	this.pingPhaseFramebuffer = new THREE.WebGLRenderTarget( this.resolution, this.resolution, NearestClampParams );
	this.pongPhaseFramebuffer = new THREE.WebGLRenderTarget( this.resolution, this.resolution, NearestClampParams );
	this.pingTransformFramebuffer = new THREE.WebGLRenderTarget( this.resolution, this.resolution, NearestClampParams );
	this.pongTransformFramebuffer = new THREE.WebGLRenderTarget( this.resolution, this.resolution, NearestClampParams );
	this.displacementMapFramebuffer = new THREE.WebGLRenderTarget( this.resolution, this.resolution, LinearClampParams );
	this.normalMapFramebuffer = new THREE.WebGLRenderTarget( this.resolution, this.resolution, LinearClampParams );

	// Define shaders and constant uniforms
	////////////////////////////////////////
	THREE.ShaderLib[ 'ocean_sim_vertex' ] = {
		vertexShader: [
			'varying vec2 vUV;',
	
			'void main (void) {',
				'vUV = position.xy * 0.5 + 0.5;',
				'gl_Position = vec4(position, 1.0 );',
			'}'
		].join( '\n' )
	};

	// 0 - The vertex shader used in all of the simulation steps
	var fullscreeenVertexShader = THREE.ShaderLib[ "ocean_sim_vertex" ];

	THREE.ShaderLib[ 'ocean_subtransform' ] = {
		uniforms: {
			"u_input": { value: null },
			"u_transformSize": { value: 512.0 },
			"u_subtransformSize": { value: 250.0 }
		},
		fragmentShader: [
			//GPU FFT using a Stockham formulation
	
			'precision highp float;',
			'#include <common>',
	
			'uniform sampler2D u_input;',
			'uniform float u_transformSize;',
			'uniform float u_subtransformSize;',
	
			'varying vec2 vUV;',
	
			'vec2 multiplyComplex (vec2 a, vec2 b) {',
				'return vec2(a[0] * b[0] - a[1] * b[1], a[1] * b[0] + a[0] * b[1]);',
			'}',
	
			'void main (void) {',
				'#ifdef HORIZONTAL',
				'float index = vUV.x * u_transformSize - 0.5;',
				'#else',
				'float index = vUV.y * u_transformSize - 0.5;',
				'#endif',
	
				'float evenIndex = floor(index / u_subtransformSize) * (u_subtransformSize * 0.5) + mod(index, u_subtransformSize * 0.5);',
	
				//transform two complex sequences simultaneously
				'#ifdef HORIZONTAL',
				'vec4 even = texture2D(u_input, vec2(evenIndex + 0.5, gl_FragCoord.y) / u_transformSize).rgba;',
				'vec4 odd = texture2D(u_input, vec2(evenIndex + u_transformSize * 0.5 + 0.5, gl_FragCoord.y) / u_transformSize).rgba;',
				'#else',
				'vec4 even = texture2D(u_input, vec2(gl_FragCoord.x, evenIndex + 0.5) / u_transformSize).rgba;',
				'vec4 odd = texture2D(u_input, vec2(gl_FragCoord.x, evenIndex + u_transformSize * 0.5 + 0.5) / u_transformSize).rgba;',
				'#endif',
	
				'float twiddleArgument = -2.0 * PI * (index / u_subtransformSize);',
				'vec2 twiddle = vec2(cos(twiddleArgument), sin(twiddleArgument));',
	
				'vec2 outputA = even.xy + multiplyComplex(twiddle, odd.xy);',
				'vec2 outputB = even.zw + multiplyComplex(twiddle, odd.zw);',
	
				'gl_FragColor = vec4(outputA, outputB);',
			'}'
		].join( '\n' )
	};

	// 1 - Horizontal wave vertices used for FFT
	var oceanHorizontalShader = THREE.ShaderLib[ "ocean_subtransform" ];

	console.log(oceanHorizontalShader);

	var oceanHorizontalUniforms = THREE.UniformsUtils.clone( oceanHorizontalShader.uniforms );
	this.materialOceanHorizontal = new THREE.ShaderMaterial( {
		uniforms: oceanHorizontalUniforms,
		vertexShader: fullscreeenVertexShader.vertexShader,
		fragmentShader: "#define HORIZONTAL \n" + oceanHorizontalShader.fragmentShader
	} );
	this.materialOceanHorizontal.uniforms.u_transformSize = { value: this.resolution };
	this.materialOceanHorizontal.uniforms.u_subtransformSize = { value: null };
	this.materialOceanHorizontal.uniforms.u_input = { value: null };
	this.materialOceanHorizontal.depthTest = false;

	// 2 - Vertical wave vertices used for FFT
	var oceanVerticalShader = THREE.ShaderLib[ "ocean_subtransform" ];
	var oceanVerticalUniforms = THREE.UniformsUtils.clone( oceanVerticalShader.uniforms );
	this.materialOceanVertical = new THREE.ShaderMaterial( {
		uniforms: oceanVerticalUniforms,
		vertexShader: fullscreeenVertexShader.vertexShader,
		fragmentShader: oceanVerticalShader.fragmentShader
	} );
	this.materialOceanVertical.uniforms.u_transformSize = { value: this.resolution };
	this.materialOceanVertical.uniforms.u_subtransformSize = { value: null };
	this.materialOceanVertical.uniforms.u_input = { value: null };
	this.materialOceanVertical.depthTest = false;

	THREE.ShaderLib[ 'ocean_initial_spectrum' ] = {
		uniforms: {
			"u_wind": { value: new THREE.Vector2( 10.0, 10.0 ) },
			"u_resolution": { value: 512.0 },
			"u_size": { value: 250.0 }
		},
		fragmentShader: [
			'precision highp float;',
			'#include <common>',
	
			'const float G = 9.81;',
			'const float KM = 370.0;',
			'const float CM = 0.23;',
	
			'uniform vec2 u_wind;',
			'uniform float u_resolution;',
			'uniform float u_size;',
	
			'float omega (float k) {',
				'return sqrt(G * k * (1.0 + pow2(k / KM)));',
			'}',
	
			'float tanh (float x) {',
				'return (1.0 - exp(-2.0 * x)) / (1.0 + exp(-2.0 * x));',
			'}',
	
			'void main (void) {',
				'vec2 coordinates = gl_FragCoord.xy - 0.5;',
	
				'float n = (coordinates.x < u_resolution * 0.5) ? coordinates.x : coordinates.x - u_resolution;',
				'float m = (coordinates.y < u_resolution * 0.5) ? coordinates.y : coordinates.y - u_resolution;',
	
				'vec2 K = (2.0 * PI * vec2(n, m)) / u_size;',
				'float k = length(K);',
	
				'float l_wind = length(u_wind);',
	
				'float Omega = 0.84;',
				'float kp = G * pow2(Omega / l_wind);',
	
				'float c = omega(k) / k;',
				'float cp = omega(kp) / kp;',
	
				'float Lpm = exp(-1.25 * pow2(kp / k));',
				'float gamma = 1.7;',
				'float sigma = 0.08 * (1.0 + 4.0 * pow(Omega, -3.0));',
				'float Gamma = exp(-pow2(sqrt(k / kp) - 1.0) / 2.0 * pow2(sigma));',
				'float Jp = pow(gamma, Gamma);',
				'float Fp = Lpm * Jp * exp(-Omega / sqrt(10.0) * (sqrt(k / kp) - 1.0));',
				'float alphap = 0.006 * sqrt(Omega);',
				'float Bl = 0.5 * alphap * cp / c * Fp;',
	
				'float z0 = 0.000037 * pow2(l_wind) / G * pow(l_wind / cp, 0.9);',
				'float uStar = 0.41 * l_wind / log(10.0 / z0);',
				'float alpham = 0.01 * ((uStar < CM) ? (1.0 + log(uStar / CM)) : (1.0 + 3.0 * log(uStar / CM)));',
				'float Fm = exp(-0.25 * pow2(k / KM - 1.0));',
				'float Bh = 0.5 * alpham * CM / c * Fm * Lpm;',
	
				'float a0 = log(2.0) / 4.0;',
				'float am = 0.13 * uStar / CM;',
				'float Delta = tanh(a0 + 4.0 * pow(c / cp, 2.5) + am * pow(CM / c, 2.5));',
	
				'float cosPhi = dot(normalize(u_wind), normalize(K));',
	
				'float S = (1.0 / (2.0 * PI)) * pow(k, -4.0) * (Bl + Bh) * (1.0 + Delta * (2.0 * cosPhi * cosPhi - 1.0));',
	
				'float dk = 2.0 * PI / u_size;',
				'float h = sqrt(S / 2.0) * dk;',
	
				'if (K.x == 0.0 && K.y == 0.0) {',
					'h = 0.0;', //no DC term
				'}',
				'gl_FragColor = vec4(h, 0.0, 0.0, 0.0);',
			'}'
		].join( '\n' )
	};

	// 3 - Initial spectrum used to generate height map
	var initialSpectrumShader = THREE.ShaderLib[ "ocean_initial_spectrum" ];
	var initialSpectrumUniforms = THREE.UniformsUtils.clone( initialSpectrumShader.uniforms );
	this.materialInitialSpectrum = new THREE.ShaderMaterial( {
		uniforms: initialSpectrumUniforms,
		vertexShader: fullscreeenVertexShader.vertexShader,
		fragmentShader: initialSpectrumShader.fragmentShader
	} );
	this.materialInitialSpectrum.uniforms.u_wind = { value: new THREE.Vector2() };
	this.materialInitialSpectrum.uniforms.u_resolution = { value: this.resolution };
	this.materialInitialSpectrum.depthTest = false;

	THREE.ShaderLib[ 'ocean_phase' ] = {
		uniforms: {
			"u_phases": { value: null },
			"u_deltaTime": { value: null },
			"u_resolution": { value: null },
			"u_size": { value: null }
		},
		fragmentShader: [
			'precision highp float;',
			'#include <common>',
	
			'const float G = 9.81;',
			'const float KM = 370.0;',
	
			'varying vec2 vUV;',
	
			'uniform sampler2D u_phases;',
			'uniform float u_deltaTime;',
			'uniform float u_resolution;',
			'uniform float u_size;',
	
			'float omega (float k) {',
				'return sqrt(G * k * (1.0 + k * k / KM * KM));',
			'}',
	
			'void main (void) {',
				'float deltaTime = 1.0 / 60.0;',
				'vec2 coordinates = gl_FragCoord.xy - 0.5;',
				'float n = (coordinates.x < u_resolution * 0.5) ? coordinates.x : coordinates.x - u_resolution;',
				'float m = (coordinates.y < u_resolution * 0.5) ? coordinates.y : coordinates.y - u_resolution;',
				'vec2 waveVector = (2.0 * PI * vec2(n, m)) / u_size;',
	
				'float phase = texture2D(u_phases, vUV).r;',
				'float deltaPhase = omega(length(waveVector)) * u_deltaTime;',
				'phase = mod(phase + deltaPhase, 2.0 * PI);',
	
				'gl_FragColor = vec4(phase, 0.0, 0.0, 0.0);',
			'}'
		].join( '\n' )
	};

	// 4 - Phases used to animate heightmap
	var phaseShader = THREE.ShaderLib[ "ocean_phase" ];
	var phaseUniforms = THREE.UniformsUtils.clone( phaseShader.uniforms );
	this.materialPhase = new THREE.ShaderMaterial( {
		uniforms: phaseUniforms,
		vertexShader: fullscreeenVertexShader.vertexShader,
		fragmentShader: phaseShader.fragmentShader
	} );
	this.materialPhase.uniforms.u_resolution = { value: this.resolution };
	this.materialPhase.depthTest = false;

	THREE.ShaderLib[ 'ocean_spectrum' ] = {
		uniforms: {
			"u_size": { value: null },
			"u_resolution": { value: null },
			"u_choppiness": { value: null },
			"u_phases": { value: null },
			"u_initialSpectrum": { value: null }
		},
		fragmentShader: [
			'precision highp float;',
			'#include <common>',
	
			'const float G = 9.81;',
			'const float KM = 370.0;',
	
			'varying vec2 vUV;',
	
			'uniform float u_size;',
			'uniform float u_resolution;',
			'uniform float u_choppiness;',
			'uniform sampler2D u_phases;',
			'uniform sampler2D u_initialSpectrum;',
	
			'vec2 multiplyComplex (vec2 a, vec2 b) {',
				'return vec2(a[0] * b[0] - a[1] * b[1], a[1] * b[0] + a[0] * b[1]);',
			'}',
	
			'vec2 multiplyByI (vec2 z) {',
				'return vec2(-z[1], z[0]);',
			'}',
	
			'float omega (float k) {',
				'return sqrt(G * k * (1.0 + k * k / KM * KM));',
			'}',
	
			'void main (void) {',
				'vec2 coordinates = gl_FragCoord.xy - 0.5;',
				'float n = (coordinates.x < u_resolution * 0.5) ? coordinates.x : coordinates.x - u_resolution;',
				'float m = (coordinates.y < u_resolution * 0.5) ? coordinates.y : coordinates.y - u_resolution;',
				'vec2 waveVector = (2.0 * PI * vec2(n, m)) / u_size;',
	
				'float phase = texture2D(u_phases, vUV).r;',
				'vec2 phaseVector = vec2(cos(phase), sin(phase));',
	
				'vec2 h0 = texture2D(u_initialSpectrum, vUV).rg;',
				'vec2 h0Star = texture2D(u_initialSpectrum, vec2(1.0 - vUV + 1.0 / u_resolution)).rg;',
				'h0Star.y *= -1.0;',
	
				'vec2 h = multiplyComplex(h0, phaseVector) + multiplyComplex(h0Star, vec2(phaseVector.x, -phaseVector.y));',
	
				'vec2 hX = -multiplyByI(h * (waveVector.x / length(waveVector))) * u_choppiness;',
				'vec2 hZ = -multiplyByI(h * (waveVector.y / length(waveVector))) * u_choppiness;',
	
				//no DC term
				'if (waveVector.x == 0.0 && waveVector.y == 0.0) {',
					'h = vec2(0.0);',
					'hX = vec2(0.0);',
					'hZ = vec2(0.0);',
				'}',
	
				'gl_FragColor = vec4(hX + multiplyByI(h), hZ);',
			'}'
		].join( '\n' )
	};

	// 5 - Shader used to update spectrum
	var spectrumShader = THREE.ShaderLib[ "ocean_spectrum" ];
	var spectrumUniforms = THREE.UniformsUtils.clone( spectrumShader.uniforms );
	this.materialSpectrum = new THREE.ShaderMaterial( {
		uniforms: spectrumUniforms,
		vertexShader: fullscreeenVertexShader.vertexShader,
		fragmentShader: spectrumShader.fragmentShader
	} );
	this.materialSpectrum.uniforms.u_initialSpectrum = { value: null };
	this.materialSpectrum.uniforms.u_resolution = { value: this.resolution };
	this.materialSpectrum.depthTest = false;

	THREE.ShaderLib[ 'ocean_normals' ] = {
		uniforms: {
			"u_displacementMap": { value: null },
			"u_resolution": { value: null },
			"u_size": { value: null }
		},
		fragmentShader: [
			'precision highp float;',
	
			'varying vec2 vUV;',
	
			'uniform sampler2D u_displacementMap;',
			'uniform float u_resolution;',
			'uniform float u_size;',
	
			'void main (void) {',
				'float texel = 1.0 / u_resolution;',
				'float texelSize = u_size / u_resolution;',
	
				'vec3 center = texture2D(u_displacementMap, vUV).rgb;',
				'vec3 right = vec3(texelSize, 0.0, 0.0) + texture2D(u_displacementMap, vUV + vec2(texel, 0.0)).rgb - center;',
				'vec3 left = vec3(-texelSize, 0.0, 0.0) + texture2D(u_displacementMap, vUV + vec2(-texel, 0.0)).rgb - center;',
				'vec3 top = vec3(0.0, 0.0, -texelSize) + texture2D(u_displacementMap, vUV + vec2(0.0, -texel)).rgb - center;',
				'vec3 bottom = vec3(0.0, 0.0, texelSize) + texture2D(u_displacementMap, vUV + vec2(0.0, texel)).rgb - center;',
	
				'vec3 topRight = cross(right, top);',
				'vec3 topLeft = cross(top, left);',
				'vec3 bottomLeft = cross(left, bottom);',
				'vec3 bottomRight = cross(bottom, right);',
	
				'gl_FragColor = vec4(normalize(topRight + topLeft + bottomLeft + bottomRight), 1.0);',
			'}'
		].join( '\n' )
	};

	// 6 - Shader used to update spectrum normals
	var normalShader = THREE.ShaderLib[ "ocean_normals" ];
	var normalUniforms = THREE.UniformsUtils.clone( normalShader.uniforms );
	this.materialNormal = new THREE.ShaderMaterial( {
		uniforms: normalUniforms,
		vertexShader: fullscreeenVertexShader.vertexShader,
		fragmentShader: normalShader.fragmentShader
	} );
	this.materialNormal.uniforms.u_displacementMap = { value: null };
	this.materialNormal.uniforms.u_resolution = { value: this.resolution };
	this.materialNormal.depthTest = false;

	THREE.ShaderLib[ 'ocean_main' ] = {
		uniforms: {
			"u_displacementMap": { value: null },
			"u_normalMap": { value: null },
			"u_geometrySize": { value: null },
			"u_size": { value: null },
			"u_projectionMatrix": { value: null },
			"u_viewMatrix": { value: null },
			"u_cameraPosition": { value: null },
			"u_skyColor": { value: null },
			"u_oceanColor": { value: null },
			"u_sunDirection": { value: null },
			"u_exposure": { value: null }
		},
		vertexShader: [
			'precision highp float;',
	
			'varying vec3 vPos;',
			'varying vec2 vUV;',
	
			'uniform mat4 u_projectionMatrix;',
			'uniform mat4 u_viewMatrix;',
			'uniform float u_size;',
			'uniform float u_geometrySize;',
			'uniform sampler2D u_displacementMap;',
	
			'void main (void) {',
				'vec3 newPos = position + texture2D(u_displacementMap, uv).rgb * (u_geometrySize / u_size);',
				'vPos = newPos;',
				'vUV = uv;',
				'gl_Position = u_projectionMatrix * u_viewMatrix * vec4(newPos, 1.0);',
			'}'
		].join( '\n' ),
		fragmentShader: [
			'precision highp float;',
	
			'varying vec3 vPos;',
			'varying vec2 vUV;',
	
			'uniform sampler2D u_displacementMap;',
			'uniform sampler2D u_normalMap;',
			'uniform vec3 u_cameraPosition;',
			'uniform vec3 u_oceanColor;',
			'uniform vec3 u_skyColor;',
			'uniform vec3 u_sunDirection;',
			'uniform float u_exposure;',
	
			'vec3 hdr (vec3 color, float exposure) {',
				'return 1.0 - exp(-color * exposure);',
			'}',
	
			'void main (void) {',
				'vec3 normal = texture2D(u_normalMap, vUV).rgb;',
	
				'vec3 view = normalize(u_cameraPosition - vPos);',
				'float fresnel = 0.02 + 0.98 * pow(1.0 - dot(normal, view), 5.0);',
				'vec3 sky = fresnel * u_skyColor;',
	
				'float diffuse = clamp(dot(normal, normalize(u_sunDirection)), 0.0, 1.0);',
				'vec3 water = (1.0 - fresnel) * u_oceanColor * u_skyColor * diffuse;',
	
				'vec3 color = sky + water;',
	
				'gl_FragColor = vec4(hdr(color, u_exposure), 1.0);',
			'}'
		].join( '\n' )
	};

	// 7 - Shader used to update normals
	var oceanShader = THREE.ShaderLib[ "ocean_main" ];
	var oceanUniforms = THREE.UniformsUtils.clone( oceanShader.uniforms );
	this.materialOcean = new THREE.ShaderMaterial( {
		uniforms: oceanUniforms,
		vertexShader: oceanShader.vertexShader,
		fragmentShader: oceanShader.fragmentShader
	} );
	// this.materialOcean.wireframe = true;
	this.materialOcean.uniforms.u_geometrySize = { value: this.resolution };
	this.materialOcean.uniforms.u_displacementMap = { value: this.displacementMapFramebuffer.texture };
	this.materialOcean.uniforms.u_normalMap = { value: this.normalMapFramebuffer.texture };
	this.materialOcean.uniforms.u_oceanColor = { value: this.oceanColor };
	this.materialOcean.uniforms.u_skyColor = { value: this.skyColor };
	this.materialOcean.uniforms.u_sunDirection = { value: new THREE.Vector3( this.sunDirectionX, this.sunDirectionY, this.sunDirectionZ ) };
	this.materialOcean.uniforms.u_exposure = { value: this.exposure };

	// Disable blending to prevent default premultiplied alpha values
	this.materialOceanHorizontal.blending = 0;
	this.materialOceanVertical.blending = 0;
	this.materialInitialSpectrum.blending = 0;
	this.materialPhase.blending = 0;
	this.materialSpectrum.blending = 0;
	this.materialNormal.blending = 0;
	this.materialOcean.blending = 0;

	// Create the simulation plane
	this.screenQuad = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2 ) );
	this.scene.add( this.screenQuad );

	// Initialise spectrum data
	this.generateSeedPhaseTexture();

	// Generate the ocean mesh
	this.generateMesh();

};

Ocean.prototype.generateMesh = function () {

	var geometry = new THREE.PlaneBufferGeometry( this.geometrySize, this.geometrySize, this.geometryResolution, this.geometryResolution );

	geometry.rotateX( Math.PI / 2 );

	this.oceanMesh = new THREE.Mesh( geometry, this.materialOcean );

};

Ocean.prototype.render = function () {

	this.scene.overrideMaterial = null;

	if ( this.changed )
		this.renderInitialSpectrum();

	this.renderWavePhase();
	this.renderSpectrum();
	this.renderSpectrumFFT();
	this.renderNormalMap();
	this.scene.overrideMaterial = null;

};

Ocean.prototype.generateSeedPhaseTexture = function() {

	// Setup the seed texture
	this.pingPhase = true;
	var phaseArray = new window.Float32Array( this.resolution * this.resolution * 4 );
	for ( var i = 0; i < this.resolution; i ++ ) {

		for ( var j = 0; j < this.resolution; j ++ ) {

			phaseArray[ i * this.resolution * 4 + j * 4 ] =  Math.random() * 2.0 * Math.PI;
			phaseArray[ i * this.resolution * 4 + j * 4 + 1 ] = 0.0;
			phaseArray[ i * this.resolution * 4 + j * 4 + 2 ] = 0.0;
			phaseArray[ i * this.resolution * 4 + j * 4 + 3 ] = 0.0;

		}

	}

	this.pingPhaseTexture = new THREE.DataTexture( phaseArray, this.resolution, this.resolution, THREE.RGBAFormat );
	this.pingPhaseTexture.wrapS = THREE.ClampToEdgeWrapping;
	this.pingPhaseTexture.wrapT = THREE.ClampToEdgeWrapping;
	this.pingPhaseTexture.type = THREE.FloatType;
	this.pingPhaseTexture.needsUpdate = true;

};

Ocean.prototype.renderInitialSpectrum = function () {

	this.scene.overrideMaterial = this.materialInitialSpectrum;
	this.materialInitialSpectrum.uniforms.u_wind.value.set( this.windX, this.windY );
	this.materialInitialSpectrum.uniforms.u_size.value = this.size;
	this.renderer.render( this.scene, this.oceanCamera, this.initialSpectrumFramebuffer, true );

};

Ocean.prototype.renderWavePhase = function () {

	this.scene.overrideMaterial = this.materialPhase;
	this.screenQuad.material = this.materialPhase;
	if ( this.initial ) {

		this.materialPhase.uniforms.u_phases.value = this.pingPhaseTexture;
		this.initial = false;

	}else {

		this.materialPhase.uniforms.u_phases.value = this.pingPhase ? this.pingPhaseFramebuffer.texture : this.pongPhaseFramebuffer.texture;

	}
	this.materialPhase.uniforms.u_deltaTime.value = this.deltaTime;
	this.materialPhase.uniforms.u_size.value = this.size;
	this.renderer.render( this.scene, this.oceanCamera, this.pingPhase ? this.pongPhaseFramebuffer : this.pingPhaseFramebuffer );
	this.pingPhase = ! this.pingPhase;

};

Ocean.prototype.renderSpectrum = function () {

	this.scene.overrideMaterial = this.materialSpectrum;
	this.materialSpectrum.uniforms.u_initialSpectrum.value = this.initialSpectrumFramebuffer.texture;
	this.materialSpectrum.uniforms.u_phases.value = this.pingPhase ? this.pingPhaseFramebuffer.texture : this.pongPhaseFramebuffer.texture;
	this.materialSpectrum.uniforms.u_choppiness.value = this.choppiness;
	this.materialSpectrum.uniforms.u_size.value = this.size;
	this.renderer.render( this.scene, this.oceanCamera, this.spectrumFramebuffer );

};

Ocean.prototype.renderSpectrumFFT = function() {

	// GPU FFT using Stockham formulation
	var iterations = Math.log( this.resolution ) / Math.log( 2 ); // log2

	this.scene.overrideMaterial = this.materialOceanHorizontal;

	for ( var i = 0; i < iterations; i ++ ) {

		if ( i === 0 ) {

			this.materialOceanHorizontal.uniforms.u_input.value = this.spectrumFramebuffer.texture;
			this.materialOceanHorizontal.uniforms.u_subtransformSize.value = Math.pow( 2, ( i % ( iterations ) ) + 1 );
			this.renderer.render( this.scene, this.oceanCamera, this.pingTransformFramebuffer );

		} else if ( i % 2 === 1 ) {

			this.materialOceanHorizontal.uniforms.u_input.value = this.pingTransformFramebuffer.texture;
			this.materialOceanHorizontal.uniforms.u_subtransformSize.value = Math.pow( 2, ( i % ( iterations ) ) + 1 );
			this.renderer.render( this.scene, this.oceanCamera, this.pongTransformFramebuffer );

		} else {

			this.materialOceanHorizontal.uniforms.u_input.value = this.pongTransformFramebuffer.texture;
			this.materialOceanHorizontal.uniforms.u_subtransformSize.value = Math.pow( 2, ( i % ( iterations ) ) + 1 );
			this.renderer.render( this.scene, this.oceanCamera, this.pingTransformFramebuffer );

		}

	}
	this.scene.overrideMaterial = this.materialOceanVertical;
	for ( var i = iterations; i < iterations * 2; i ++ ) {

		if ( i === iterations * 2 - 1 ) {

			this.materialOceanVertical.uniforms.u_input.value = ( iterations % 2 === 0 ) ? this.pingTransformFramebuffer.texture : this.pongTransformFramebuffer.texture;
			this.materialOceanVertical.uniforms.u_subtransformSize.value = Math.pow( 2, ( i % ( iterations ) ) + 1 );
			this.renderer.render( this.scene, this.oceanCamera, this.displacementMapFramebuffer );

		} else if ( i % 2 === 1 ) {

			this.materialOceanVertical.uniforms.u_input.value = this.pingTransformFramebuffer.texture;
			this.materialOceanVertical.uniforms.u_subtransformSize.value = Math.pow( 2, ( i % ( iterations ) ) + 1 );
			this.renderer.render( this.scene, this.oceanCamera, this.pongTransformFramebuffer );

		} else {

			this.materialOceanVertical.uniforms.u_input.value = this.pongTransformFramebuffer.texture;
			this.materialOceanVertical.uniforms.u_subtransformSize.value = Math.pow( 2, ( i % ( iterations ) ) + 1 );
			this.renderer.render( this.scene, this.oceanCamera, this.pingTransformFramebuffer );

		}

	}

};

Ocean.prototype.renderNormalMap = function () {

	this.scene.overrideMaterial = this.materialNormal;
	if ( this.changed ) this.materialNormal.uniforms.u_size.value = this.size;
	this.materialNormal.uniforms.u_displacementMap.value = this.displacementMapFramebuffer.texture;
	this.renderer.render( this.scene, this.oceanCamera, this.normalMapFramebuffer, true );

};
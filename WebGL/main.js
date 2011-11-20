/*
 * CS4810 Assignment 3 (done via WebGL)
 * 
 * Note that this REQUIRES gl-matrix.js to be pre-imported.
 */

///
/// Utility Functions
///

/**
 * Removes the first occurence of value from an array (if it exists).
 */
Array.prototype.remove = function(value) {
	var index = this.indexOf(value);
	if(index < 0)
		return this;
	var before = this.slice(0, index);
	var after = this.slice(index + 1);
	this.length = index;
	return before.concat(after);
}

/**
 * Calls func every timedelta milliseconds indefinitely.
 * 
 * @param func The function to call
 * @param timedelta The number of milliseconds to wait between calls
 */
function repeat(func, timedelta) {
	function wrapper() {
		func();
		setTimeout(wrapper, timedelta);
	}
	wrapper();
}

// 
// GLHelper
// 

/**
 * Creates an instance of GLHelper with the provided canvas object.
 */
function GLHelper(canvas) {
	var gl = null;
	gl = canvas.getContext("experimental-webgl");
	gl.viewportWidth = canvas.width;
	gl.viewportHeight = canvas.height;
	gl.viewport(0, 0, canvas.width, canvas.height);
	if (!gl) {
		throw "Error initializing WebGL!  You must use a WebGL-compatible browser.";
	}

	// clear the canvas to black
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT);

	/**
	 * Loads the provided MTL-formatted material library into a MaterialLibrary
	 * object.
	 * 
	 * @param source
	 *            The .mtl source for the material library
	 */
	function MaterialLibrary(source) {
		var mats = {};

		return mats;
	}

	/**
	 * Creates a Mesh object with the provided VBO, IBO, and material.
	 * 
	 */
	function Mesh(vbo, ibo, material, numFaces) {
		/**
		 * Rasterizes the mesh by simply drawing triangles from the VBO and IBO.
		 * 
		 * NOTE that this ignores any material properties and that the
		 * appropriate shaders MUST be specified before calling this function.
		 * 
		 */
		function rasterize() {
			gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
			gl.enableVertexAttribArray(0);
			gl.enableVertexAttribArray(1);
			gl.enableVertexAttribArray(2);
			gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 8 * 4, 0 * 4);
			gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 8 * 4, 3 * 4);
			gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 8 * 4, 6 * 4);
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
			gl.drawElements(gl.TRIANGLES, numFaces, gl.UNSIGNED_SHORT, 0);
		}

		var mesh = {};
		mesh.rasterize = rasterize;
		return mesh;
	}

	/**
	 * Loads the provided source OBJ-formatted 3D model data into a Model
	 * object.
	 * 
	 * 
	 * @param source
	 *            The .obj source for the mesh geometry. NOTE that the obj data
	 *            provided MUST contain only triangles (quads will be ignored).
	 * 
	 * @param matLib
	 *            The material library referenced by the model to load
	 */
	function Model(meshes) {
		var transformation = mat4.create();

		function rasterize() {
			meshes.forEach(function(mesh) {
				mesh.rasterize(transformation);
			});
		}

		return {
			rasterize : rasterize
		};
	}

	/**
	 * Loads model data given an OBJ-format string of mesh data and a pre-loaded
	 * material library. Note that any mtllib declarations in the OBJ file are
	 * ignored and the matLib provided is assumed to contain material records
	 * for all those referenced by the OBJ source provided.
	 * 
	 * @param source
	 *            The .obj source text for the model
	 * @param matLib
	 *            The material library containing all materials referenced by
	 *            the model
	 */
	function ModelFromOBJ(source, matLib) {
		// read in mesh data line-by-line while adding verteces, normals,
		// texture
		// coordinates, and faces
		var lines = source.split("\n");

		// these are initiated with the default values (this is especially
		// useful for OBJ models without texture coordinates)
		// OBJ files are also indexed by 1, so this initialization serves 2
		// purposes
		var vertexList = [ [ 0, 0, 0 ] ];
		var normalList = [ [ 0, 0, 0 ] ];
		var textureList = [ [ 0, 0 ] ];

		// array of interleaved vertex, normal, texture data all flattened into
		// a single list of floats
		var vntData = [];

		// maps obj face-vertex strings (ie: "1/2/3") to indeces into nvtList
		var vntCache = {};

		// list of indeces into the nvtList for each face (the offset of the
		// vertex data)
		var indexList = [];

		// list of {indexList, material} objects for each group of faces with a
		// common material
		var faceGroups = [];

		// the current material to use for all faces
		var curMat = null;

		var addVertex = function(line) {
			var vertex = line.split(" ").slice(1).map(function(coord) {
				return parseFloat(coord);
			});
			vertexList.push(vertex);
		}
		var addNormal = function(line) {
			var normal = line.split(" ").slice(1).map(function(coord) {
				return parseFloat(coord);
			});
			normalList.push(normal);
		}
		var addTextureCoord = function(line) {
			var coords = line.split(" ").slice(1).map(function(coord) {
				return parseFloat(coord);
			});
			textureList.push(coords);
		}

		var addFace = function(line) {
			// loop through all verteces, adding to nvtList when a new unique
			// vertex
			// is found, and pushing to indexList each time
			line.split(" ").slice(1).forEach(function(vString) {
				// if this vertex (with these particular texture coords and
				// normal)
				// has not been found, add it to the cache
				if (!(vString in vntCache)) {
					var lastIndex = vntData.length;
					var indices = vString.split("/").map(function(i) {
						// parse the index, or 0 if it is non-existent
						var index = parseInt(i, 10);
						if (index) { // if index is valid (missing texture
							// coordinates result in an "undefined"
							// index)
							return index;
						} else {
							return 0;
						}
					});
					vertexList[indices[0]].forEach(function(f) {
						vntData.push(f);
					});
					normalList[indices[2]].forEach(function(f) {
						vntData.push(f);
					});
					textureList[indices[1]].forEach(function(f) {
						vntData.push(f);
					});
					vntCache[vString] = lastIndex;
				}
				// push the vertex index to the index list
				indexList.push(vntCache[vString] / 8);
			});
		}

		// every time a new material definition is found, pop off all faces
		// found before now into a new faceGroup
		var useMTL = function(line) {
			if (indexList.length > 0) {
				faceGroups.push({
					indexList : indexList,
					material : curMat
				});
			}
			indexList = [];
			var matName = line.split(" ")[1];
			curMat = matLib[matName];
		}

		lines.forEach(function(line) {
			if (line.indexOf("v ") === 0) {
				addVertex(line);
			}
			if (line.indexOf("vn ") === 0) {
				addNormal(line);
			}
			if (line.indexOf("vt ") === 0) {
				addTextureCoord(line);
			}
			if (line.indexOf("f ") === 0) {
				addFace(line);
			}
			if (line.indexOf("usemtl") === 0) {
				useMTL(line);
			}
		});

		// this should pop off any remaining faces into a new faceGroup element
		useMTL("");

		var vbo = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vntData),
				gl.STATIC_DRAW);

		// process face groups into meshes (create an IBO for each, but link to
		// the common VBO)
		var meshes = faceGroups.map(function(faces) {
			var ibo = gl.createBuffer();
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(
					faces.indexList), gl.STATIC_DRAW);
			return Mesh(vbo, ibo, faces.material, faces.indexList.length);
		});

		return Model(meshes);
	}

	// cache shaders to avoid redundent recompilation for programs using the
	// same source code
	var shaderCache = {};

	/**
	 * Compiles and links the provided vertex and pixel shaders using the
	 * mapping provided to specify vertex shader attributes.
	 * 
	 * 
	 * @param vertexSource
	 *            The source code for the vertex shader.
	 * @param pixelSource
	 *            The source code for the pixel shader.
	 * @param attributeMap
	 *            A list of [attribute_name, index] pairs to use when binding
	 *            attribute locations.
	 * @throws string
	 *             Throws exception if unable to succesfully compile the given
	 *             shaders.
	 */
	function Program(vertexSource, pixelSource) {
		var shader;
		if (!shaderCache[vertexSource]) {
			shader = gl.createShader(gl.VERTEX_SHADER);
			gl.shaderSource(shader, vertexSource);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				throw "Error compiling vertex shader: "
						+ gl.getShaderInfoLog(shader);
				return null;
			}
			shaderCache[vertexSource] = shader;
		}
		if (!shaderCache[pixelSource]) {
			shader = gl.createShader(gl.FRAGMENT_SHADER);
			gl.shaderSource(shader, pixelSource);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				throw "Error compiling pixel shader: "
						+ gl.getShaderInfoLog(shader);
				return null;
			}
			shaderCache[pixelSource] = shader;
		}
		var pixelShader = shaderCache[pixelSource];
		var vertexShader = shaderCache[vertexSource];
		var prog = gl.createProgram();
		gl.attachShader(prog, vertexShader);
		gl.attachShader(prog, pixelShader);
		gl.linkProgram(prog);

		if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
			alert("Unable to link shaders.");
			return null;
		}

		var paramCache = {};
		function use() {
			gl.useProgram(prog);
		}

		return {
			prog : prog,
			use : use,
			setUniform : null
		};
	}

	/**
	 * Represents a post-rasterization effect (lighting, blur, ...) which takes
	 * one or more textures as input and outputs to one or more textures where
	 * the vertex shader is trivial and expects the simplest possible geometry
	 * covering the entire screen.
	 */
	function DeferredEffect(vertexSource, pixelSource) {
		var prog = Program(vertexSource, pixelSource);

		return {}
	}

	function Camera() {
		var view;
		var projection;

		function getView() {
			return view;
		}

		function getProjection() {
			return projection;
		}

		function setProjection(fovy, aspect, zMin, zMax) {
			projection = mat4.projection(fovy, aspect, zMin, zMax);
		}

		function multR(mat) {
			mat4.multiply(view, mat, view);
		}

		function multL(mat) {
			mat4.multiply(mat, view, view);
		}

		return {
			getView : getView,
			getProjection : getProjection,
			setProjection : setProjection,
			multR : multR,
			multL : multL
		};
	}

	function Light(lightColor, position, direction) {
		if (!lightColor) {
			lightColor = [ 1, 1, 1 ];
		}

		var color = vec3.create(lightColor);

		function getColor() {
			return color;
		}

		function setColor(c) {
			color = vec3.create(c);
		}

		var light = {
			getColor : getColor,
			setColor : setColor
		};
	}

	function Scene() {
		var models = [];
		var lights = [];
		function addModel(model) {
			models.push(model);
		}
		function removeModel(model) {
			var index = models.indexOf(model);
			var before = models.slice(0, index);
			var after = models.slice(index + 1);
			models = before.concat(after);
		}
		var scene = {
			addModel : addModel,
			removeModel : removeModel
		};
		return scene;
	}

	var GL = {
		MaterialLibrary : MaterialLibrary,
		Model : Model,
		ModelFromOBJ : ModelFromOBJ,
		Program : Program,
		Camera : Camera,
		Scene : Scene,
		gl : gl
	}
	return GL;
}

import {Mesh} from "./mesh.js";
import { initShaderProgram } from "./shaders.js";
import { loadTexture, loadNullTex, loadNullNormalTex } from "./loadimages.js";

class Model{

    visitedNodes = [];
    stack = [];
    matrixtransform = [];
    parentMap = new Map();//child node index key maps to parent node index (root node maps to -1)

    //In GLTF mesh may not be single drawable unit if it has multiple primitives: ignore this gltf convention, mesh=1 drawable unit
    meshes = [];

    shaderProgramInfo;

    constructor(glContext, shaders, depthProgInfo, JSONsrc, buffer, indexBuff, jsArray, gltextureArr){
        this.gl = glContext;

        //this.vertexShader = shaders[0];
        //this.fragmentShader = shaders[1];
        this.shaderProg = shaders;

        this.gltf = JSONsrc;
        this.modelBuffer = buffer;
        this.indexBuffer = indexBuff;
        this.textures = gltextureArr;

        this.CPUArray = jsArray;//Actual buffer will be used to get the model vertices for collision detection

        //this.initModelShaders();
        this.shaderProgramInfo = shaders;
        //this.#initDepthShaders();
        this.depthProgramInfo = depthProgInfo;
    }

    static async loadGLTF(gl, shaders, depthshaders, path, filename){
        const response = await fetch(path.concat(filename));
        const jsonGLTF = await response.json();

        let binname = await jsonGLTF["buffers"][0]["uri"];
        console.log(binname);

        //fetch raw binary file referenced in gltf file
        const binres = await fetch(path.concat(binname), {
            // Adding Get request
            method: "GET",
            // Setting headers
            headers: {
               'Content-Type': 'application/octet-stream',
            },
            // Setting response type to arraybuffer 
            responseType: "arraybuffer",
        });
        const resBlob = await binres.blob();
        const Arrbuffer = await resBlob.arrayBuffer();
        let bufferLength = Arrbuffer.byteLength;
        console.log("Buffer Length: " + bufferLength + " bytes");

        const typedArray = new Float32Array(Arrbuffer);//THIS IS NEEDED TO KEEP BUFFER in CPU MEMORY
        
        //Array Buffer obj needs to be converted into DataView Obj
        const viewBuffer = new DataView(Arrbuffer);

        //Finally load entire bin file buffer into GL buffer
        const modelBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, modelBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, viewBuffer, gl.STATIC_DRAW);

        //need 2nd copy of buffer since WEBGL can't bind same buffer to array and element array binding points
        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, viewBuffer, gl.STATIC_DRAW);


        //load textures if any
        let textures;
        if (jsonGLTF.textures != undefined){
            textures = await this.#loadTextures(jsonGLTF, path, gl);
        }

        return new Model(gl, shaders, depthshaders, jsonGLTF, modelBuffer, indexBuffer, typedArray, textures);
    }

    static async #loadTextures(gltf, modelpath, gl){
        let textures = gltf.textures;
        let glTextures = [];

        for (let i = 0; i < textures.length; i++){
            let texture = textures[i];
            let imURI = gltf.images[texture.source].uri;//get relative path of image files
            console.log(modelpath.concat(imURI));
            const testpath = "textures/cubetexture.png"
            glTextures.push(loadTexture(gl, modelpath.concat(imURI)));
            //glTextures.push(loadTexture(gl, testpath));
        }
        glTextures.unshift(loadNullNormalTex(gl));
        glTextures.unshift(loadNullTex(gl));

        return glTextures;
    }

    static async #loadNullTextures(gl){
        let nullTextures = [];
        nullTextures.push(loadNullTex(gl));//null image texture
        nullTextures.push(loadNullNormalTex(gl));//null normal texture

        return nullTextures;

    }

    draw(modelTransformMatrix, camera, lightdir, depthMap){
        //Shader program is attached here, shader uniforms can be accessed both here and in mesh draw calls
        this.gl.useProgram(this.shaderProgramInfo.program);

        this.gl.uniform3fv(this.shaderProgramInfo.uniformLocations.camPos, camera.getPosition());

        this.gl.uniformMatrix4fv(this.shaderProgramInfo.uniformLocations.viewMatrix, false, camera.getViewMatrix());
        this.gl.uniformMatrix4fv(this.shaderProgramInfo.uniformLocations.modelMatrix, false, modelTransformMatrix);

        //Projection Matrix
        const fieldOfView = (45 * Math.PI) / 180; // in radians
        const aspect = this.gl.canvas.clientWidth / this.gl.canvas.clientHeight;
        const zNear = 0.1;
        const zFar = 100.0;
        const projectionMatrix = glMatrix.mat4.create();
        glMatrix.mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);
        this.gl.uniformMatrix4fv(this.shaderProgramInfo.uniformLocations.projectionMatrix, false, projectionMatrix);

        /*
        //Build the normal Matrix and put it into uniform in shader
        const normalMatrix = glMatrix.mat3.create();
        glMatrix.mat3.normalFromMat4(normalMatrix, modelTransformMatrix);
        this.gl.uniformMatrix3fv(this.shaderProgramInfo.uniformLocations.normalMatrix, false, normalMatrix);
        */

        //directional light
        this.gl.uniform3fv(this.shaderProgramInfo.uniformLocations.lightDir, lightdir);


        //attach light space transform matrix
        this.gl.uniformMatrix4fv(this.shaderProgramInfo.uniformLocations.lightSpaceMatrix, false, this.lightSpaceMatrix);

        //attach shadow map texture
        this.gl.activeTexture(this.gl.TEXTURE3);
        this.gl.bindTexture(this.gl.TEXTURE_2D, depthMap);
        this.gl.uniform1i(this.shaderProgramInfo.uniformLocations.shadowMap, 3);

        
        for (let i = 0; i < this.meshes.length; i++){
            this.meshes[i].draw(modelTransformMatrix);
        }
        
        
        //Significant star destroyer meshes: 10, 14, 19, 20, 21
        //phantom mesh: 13, 22, 23
        //this.meshes[15].draw(modelTransformMatrix);
        
    }


    renderDepth(modelTransformMatrix, shipCenter, radarCam = undefined){// camera, lightdir ADD ARGUMENTS LATER
        //this.gl.clear(this.gl.DEPTH_BUFFER_BIT);
        this.gl.useProgram(this.depthProgramInfo.program);

        if (radarCam == undefined){
            //const zNear = 1.0, zFar = 20.0;
            const orthoProj = glMatrix.mat4.create();
            //glMatrix.mat4.ortho(orthoProj, -10.0, 10.0, -10.0, 10.0, zNear, zFar);

            const zNear = 2.0, zFar = 18.0;
            //glMatrix.mat4.ortho(orthoProj, -10.0, 10.0, -10.0, 10.0, zNear, zFar);
            glMatrix.mat4.ortho(orthoProj, -20.0, 20.0, -20.0, 20.0, zNear, zFar);

            const lightView = glMatrix.mat4.create();
            const eyePos = glMatrix.vec3.fromValues(shipCenter[0] - 10.0, shipCenter[1], shipCenter[2]);
            //glMatrix.mat4.lookAt(lightView, [-10.0, 0.0, -10.0], [0.0, 0.0, -10.0], [0.0, 1.0, 0.0]);
            glMatrix.mat4.lookAt(lightView, eyePos, shipCenter, [0.0, 1.0, 0.0]);


            
            
            const lightSpaceMatrix = glMatrix.mat4.create();
            glMatrix.mat4.multiply(lightSpaceMatrix, orthoProj, lightView);
            this.lightSpaceMatrix = lightSpaceMatrix;//store matrix as field since actual shader will need it

            this.gl.uniformMatrix4fv(this.depthProgramInfo.lightSpaceMatrix, false, lightSpaceMatrix);
            this.gl.uniformMatrix4fv(this.depthProgramInfo.modelMatrix, false, modelTransformMatrix);
        }
        else{
            const radarSpaceMatrix = glMatrix.mat4.create();
            glMatrix.mat4.multiply(radarSpaceMatrix, radarCam.getProjMatrix(), radarCam.getViewMatrix());
            this.gl.uniformMatrix4fv(this.depthProgramInfo.lightSpaceMatrix, false, radarSpaceMatrix);
            this.gl.uniformMatrix4fv(this.depthProgramInfo.modelMatrix, false, modelTransformMatrix);
        }
        for (let i = 0; i < this.meshes.length; i++){
            this.meshes[i].renderDepth();
        }
    }


    //Main function that is called after object is initialized
    processScene(){
        let defaultScene = this.gltf.scene;
        //console.log(this.gltf.scenes[0].name);
        let sceneNodes = this.gltf.scenes[defaultScene].nodes;
        let nodeStack = [];
        //load initial nodes listed in scene onto a stack
        for (let i = 0; i < sceneNodes.length; i++) {
            nodeStack.push(sceneNodes[i]);
            this.parentMap.set(sceneNodes[i], -1);
        }

        /*
        *   In GLTF 2.0, the graph made by the nodes is guaranteed to be a tree (connected acyclic graph)
        */
        //traverse the nodes on the stack
        while(nodeStack.length > 0){
            let index = nodeStack.pop();//parent index
            let node = this.gltf.nodes[index];
            
            this.#processNode(node, index);

            //Add node's children to stack; Add map child -> parent pair to map
            if (node.children != undefined){
                for (let i = 0; i < node.children.length; i++) {
                    nodeStack.push(node.children[i]);
                    this.parentMap.set(node.children[i], index);
                }
            }
        }
    }

    #processNode(node, nodeIndex){
        if (node.mesh != undefined){
            let meshIndex = node.mesh;
            let mesh = this.gltf.meshes[meshIndex];

            let matrixarr = [];
            let parentNodeIndex = nodeIndex;
            while(parentNodeIndex != -1){//in the first iteration the "parent node is the node itself"
                let parentNode = this.gltf.nodes[parentNodeIndex];
                if (parentNode.matrix != undefined){
                    matrixarr.unshift(this.#arrToGLMatrix(parentNode.matrix));//push_front
                }
                parentNodeIndex = this.parentMap.get(parentNodeIndex);//retrieve the parentNodeIndex and ressaign current index
            }

            this.#processMesh(mesh, matrixarr);
        }
    }

    //TO DO: process the material that a mesh possesses 
    #processMesh(mesh, matrixarr){
        let transform = this.#getFinalTransformMatrix(matrixarr);
        
        //primitive is the "traditional mesh": the drawable piece
        for (let i = 0; i < mesh.primitives.length; i++){
            let primitive = mesh.primitives[i];
            let attributes = primitive.attributes;

            let positionInfo;
            let normalInfo;
            let textureInfo;
            let indexInfo;
            let materialInfo;

            //data in the "attribute": position, normals, texture
            if (attributes.POSITION != undefined)
                positionInfo = this.#processAccessor(attributes.POSITION);
            if (attributes.NORMAL != undefined)
                normalInfo = this.#processAccessor(attributes.NORMAL);
            if (attributes.TEXCOORD_0 != undefined)
                textureInfo = this.#processAccessor(attributes.TEXCOORD_0);

            //data in the primitive object (outside "attribute"): indices
            if (primitive.indices != undefined)
                indexInfo = this.#processAccessor(primitive.indices);

            //specify drawing mode (default = 4 GL.TRIANGLES)
            let mode;
            if (primitive.mode != undefined){
                switch (primitive.mode){
                    case 4:
                        mode = this.gl.TRIANGLES;
                        break;
                    case 1:
                        mode = this.gl.LINES;
                        break;
                    default:
                        console.log("Error, unaccounted drawing mode: " + primitive.mode);
                }
            }
            else mode = this.gl.TRIANGLES;

            if(primitive.material != undefined)
                materialInfo = this.#processMaterial(primitive.material);

            let attributeInfo = {
                position: positionInfo,
                normal: normalInfo,
                texture: textureInfo,
                index: indexInfo,
                drawMode: mode,
            };
            this.meshes.push(new Mesh(this.gl, this.modelBuffer, this.indexBuffer, this.shaderProgramInfo,
                this.depthProgramInfo, transform, attributeInfo, materialInfo, this.textures));
        }

    }

    #processMaterial(index){
        let material = this.gltf.materials[index];

        const materialInfo = new Object();

        const pbrInfo = new Object();
        pbrInfo.colorFactor = [1.0, 1.0, 1.0, 1.0];
        if (material.pbrMetallicRoughness != undefined){
            if (material.pbrMetallicRoughness.baseColorFactor != undefined)
                pbrInfo.colorFactor = material.pbrMetallicRoughness.baseColorFactor;

            if(material.pbrMetallicRoughness.metallicFactor != undefined)
                pbrInfo.metallicFactor = material.pbrMetallicRoughness.metallicFactor;
            else pbrInfo.metallicFactor = 1.0;

            if(material.pbrMetallicRoughness.roughnessFactor != undefined)
                pbrInfo.roughnessFactor = material.pbrMetallicRoughness.roughnessFactor;
            else pbrInfo.roughnessFactor = 1.0;

            if (material.pbrMetallicRoughness.baseColorTexture != undefined){
                pbrInfo.TextureIndex = material.pbrMetallicRoughness.baseColorTexture.index;
                if (material.pbrMetallicRoughness.baseColorTexture.texCoord != undefined)
                    pbrInfo.TextureCoordsIndex = material.pbrMetallicRoughness.baseColorTexture.texCoord;
                else pbrInfo.TextureCoordsIndex = 0;
            }
        }

        if (material.doubleSided != undefined) materialInfo.doubleSided = material.doubleSided;
        else materialInfo.doubleSided = false;

        if (material.emissiveFactor != undefined) materialInfo.emissiveFactor = material.emissiveFactor;
        else materialInfo.emissiveFactor = [0.0, 0.0, 0.0];

        if (material.normalTexture != undefined){
            materialInfo.normalTexIndex = material.normalTexture.index;
            if (material.normalTexture.texCoord != undefined) materialInfo.normalTexCoordsIndex = material.normalTexture.texCoord;
            else materialInfo.normalTexCoordsIndex = 0;
        }
        
        materialInfo.PBR = pbrInfo;

        return materialInfo;
    }

    #processAccessor(index){//also processes the Accessors' corresponing BufferView
        const dataInfo = new Object();

        let accessor = this.gltf.accessors[index];

        //Store Min and Max Attributes of accessor
        let max;
        if (accessor.max != undefined){
            switch(accessor.type){
                case "VEC3":
                    max = glMatrix.vec3.fromValues(accessor.max[0], accessor.max[1], accessor.max[2]);
                    break;
                case "VEC2":
                    max = glMatrix.vec2.fromValues(accessor.max[0], accessor.max[1]);
                    break;
                default:
                    dataInfo.numComponents = undefined;
                    console.log("Error: no matching Type found");
            }
        }
        let min;
        if (accessor.min != undefined){
            switch(accessor.type){
                case "VEC3":
                    min = glMatrix.vec3.fromValues(accessor.min[0], accessor.min[1], accessor.min[2]);
                    break;
                case "VEC2":
                    min = glMatrix.vec2.fromValues(accessor.min[0], accessor.min[1]);
                    break;
                default:
                    dataInfo.numComponents = undefined;
                    console.log("Error: no matching Type found");
            }
        }



        let bufferView = this.gltf.bufferViews[accessor.bufferView];

        //specify the bytesize of the datatype ()
        switch (accessor.componentType){
            case 5126://GL_FLOAT: 4 bytes
                dataInfo.typeSize = 4;
                dataInfo.type = this.gl.FLOAT;
                break;
            case 5125://GL_UNSIGNED_INT: 4 bytes
                dataInfo.typeSize = 4;
                dataInfo.type = this.gl.UNSIGNED_INT;
                break;
            case 5123://GL_UNSIGNED_SHORT:
                dataInfo.typeSize = 2;
                dataInfo.type = this.gl.UNSIGNED_SHORT;
                break;
            default:
                console.log("Error: Component Type value not taken into account");
                dataInfo.typeSize = undefined;
        }
        //specify numComponents: SCALAR = 1, VEC2 = 2, VEC3 = 3 values per iteration
        switch(accessor.type){
            case "VEC3":
                dataInfo.numComponents = 3;
                break;
            case "VEC2":
                dataInfo.numComponents = 2;
                break;
            case "SCALAR":
                dataInfo.numComponents = 1;
                break;
            default:
                dataInfo.numComponents = undefined;
                console.log("Error: no matching Type found");
        }

        //specify which raw buffer mesh is from:
        dataInfo.buffer = bufferView.buffer;

        //calculating offset: bufferView gives byte offset relative to buffer, accessor gives byte offset relative to bufferView
        dataInfo.totalByteOffset = 0;
        if (bufferView.byteOffset != undefined) dataInfo.totalByteOffset += bufferView.byteOffset;
        if (accessor.byteOffset != undefined) dataInfo.totalByteOffset += accessor.byteOffset;

        //calculating stride
        if (bufferView.byteStride != undefined) dataInfo.byteStride = bufferView.byteStride;
        else dataInfo.byteStride = 0;

        //specify count: number of data elements
        dataInfo.count = accessor.count;

        dataInfo.min = min;
        dataInfo.max = max;


        return dataInfo;
        
    }

    //multiply all matrices in the matrix array to get 1 single transformation matrix
    #getFinalTransformMatrix(matrixarr){
        let finalMatrix = glMatrix.mat4.create();
        for (let i = 0; i < matrixarr.length; i++){
            glMatrix.mat4.multiply(finalMatrix, finalMatrix, matrixarr[i]);
        }
        return finalMatrix;
    }

    #arrToGLMatrix(array){
        //use Math.fround to convert Json doubles to single precision float
        let matrix = glMatrix.mat4.fromValues(Math.fround(array[0]), Math.fround(array[1]), Math.fround(array[2]), Math.fround(array[3]),
                                            Math.fround(array[4]), Math.fround(array[5]), Math.fround(array[6]), Math.fround(array[7]),
                                            Math.fround(array[8]), Math.fround(array[9]), Math.fround(array[10]), Math.fround(array[11]),
                                            Math.fround(array[12]), Math.fround(array[13]), Math.fround(array[14]), Math.fround(array[15]));
        return matrix;
    }
}

//------------#########################---------------------------
//OUTSIDE THE MODEL CLASS
function initModelShaderInfo(gl, shaderProgram){
    //const shaderProgram = initShaderProgram(this.gl, this.vertexShader, this.fragmentShader);
    //const shaderProgram = this.shaderProg;
    const shaderProgramInfo = {
        program: shaderProgram,
        attribLocations: {
          vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
          textureCoord: gl.getAttribLocation(shaderProgram, "aTextureCoord"),
          normalVec: gl.getAttribLocation(shaderProgram, "aNormal"),
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
            viewMatrix: gl.getUniformLocation(shaderProgram, "uViewMatrix"),
            modelMatrix: gl.getUniformLocation(shaderProgram, "uModelMatrix"),
            meshMatrix: gl.getUniformLocation(shaderProgram, "uLocalMeshMatrix"),

            //Material Parameters Uniform Locations
            albedoMap: gl.getUniformLocation(shaderProgram, "albedoMap"),
            normalMap: gl.getUniformLocation(shaderProgram, "normalMap"),
            roughness: gl.getUniformLocation(shaderProgram, "roughness"),
            metallic: gl.getUniformLocation(shaderProgram, "metallic"),
            ao: gl.getUniformLocation(shaderProgram, "ao"),
            baseColor: gl.getUniformLocation(shaderProgram, "baseColor"),

            lightSpaceMatrix: gl.getUniformLocation(shaderProgram, "lightSpaceMatrix"),
            normalMatrix: gl.getUniformLocation(shaderProgram, "normalMatrix"),
            lightDir: gl.getUniformLocation(shaderProgram, "lightDir"),
            camPos: gl.getUniformLocation(shaderProgram, "camPos"),
            shadowMap: gl.getUniformLocation(shaderProgram, "shadowMap"),
        },
    };
    return shaderProgramInfo;
}

function initDepthShaders(gl){
    const depthVS = `#version 300 es
    in vec4 aPos;
    uniform mat4 lightSpaceMatrix;
    uniform mat4 ModelMatrix;
    uniform mat4 MeshMatrix;

    void main(){
        gl_Position = lightSpaceMatrix * ModelMatrix * MeshMatrix * aPos;
    }
    `
    const depthFS = `#version 300 es
    void main(){
        // gl_FragDepth = gl_FragCoord.z;
    }
    `
    const depthProgram = initShaderProgram(gl, depthVS, depthFS);
    let depthProgramInfo = {
        program: depthProgram,
        vertexPosition: gl.getAttribLocation(depthProgram, "aPos"),
        lightSpaceMatrix: gl.getUniformLocation(depthProgram, "lightSpaceMatrix"),
        modelMatrix: gl.getUniformLocation(depthProgram, "ModelMatrix"),
        meshMatrix: gl.getUniformLocation(depthProgram, "MeshMatrix"),
    }
    return depthProgramInfo;
}

export {initModelShaderInfo, initDepthShaders};
export {Model};
import { initShaderProgram } from "./shaders.js";

class ExplosionManager{
    #sphere;
    #gl;
    #shaderInfo;
    #explTexture;
    #tempExplosionArr = [];
    #permanentExplosionArr = [];
    constructor(sphereRef, texture){
        this.#sphere = sphereRef;//Reference to the sphere object created in main file
        this.#gl = this.#sphere.gl;
        this.#explTexture = texture;

        //const pos = glMatrix.vec3.fromValues(1.0, 1.0, -1.0);
        //this.#tempExplosionArr.push(new Explosion(pos));

        this.#shaderInfo = initExplosionShaders(this.#gl);
    }

    resetExplosions(){//reset all explosion arrays to 0
        this.#tempExplosionArr.length = 0;
        this.#permanentExplosionArr.length = 0;
    }

    update(deltaTime){
        //remove inactive explosions from array only if array gets too long
        if (this.#tempExplosionArr.length > 30){
            let inactiveCount = 0;
            while (!this.#tempExplosionArr[inactiveCount].isActive() && inactiveCount < this.#tempExplosionArr.length){
                inactiveCount++;
            }
            this.#tempExplosionArr.splice(0, inactiveCount);
        }

        for (let i = 0; i < this.#tempExplosionArr.length; ++i){
            this.#tempExplosionArr[i].update(deltaTime);
        }
        for (let i = 0; i < this.#permanentExplosionArr.length; ++i){
            this.#permanentExplosionArr[i].update(deltaTime);
        }
    }

    draw(camera){
        this.#gl.bindVertexArray(null);

        //Projection Matrix
        const fieldOfView = (45 * Math.PI) / 180; // in radians
        const aspect = this.#gl.canvas.clientWidth / this.#gl.canvas.clientHeight;
        const zNear = 0.1;
        const zFar = 100.0;
        const projectionMatrix = glMatrix.mat4.create();
        glMatrix.mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

        this.#gl.useProgram(this.#shaderInfo.program);
        this.#gl.uniformMatrix4fv(this.#shaderInfo.ProjMatLoc, false, projectionMatrix);
        this.#gl.uniformMatrix4fv(this.#shaderInfo.ViewMatLoc, false, camera.getViewMatrix());


        // draw a sphere with interleaved mode
        this.#gl.bindBuffer(this.#gl.ARRAY_BUFFER, this.#sphere.vboVertex);
        this.#gl.vertexAttribPointer(this.#shaderInfo.posLoc,  3, this.#gl.FLOAT, false, this.#sphere.stride, 0);
        this.#gl.enableVertexAttribArray(this.#shaderInfo.posLoc);
        this.#gl.vertexAttribPointer(this.#shaderInfo.normalLoc, 3, this.#gl.FLOAT, false, this.#sphere.stride, 12);
        this.#gl.enableVertexAttribArray(this.#shaderInfo.normalLoc);
        this.#gl.vertexAttribPointer(this.#shaderInfo.texLoc, 2, this.#gl.FLOAT, false, this.#sphere.stride, 24);
        this.#gl.enableVertexAttribArray(this.#shaderInfo.texLoc);

        this.#gl.bindBuffer(this.#gl.ELEMENT_ARRAY_BUFFER, this.#sphere.vboIndex);

        //texture binding
        this.#gl.activeTexture(this.#gl.TEXTURE3);
        this.#gl.bindTexture(this.#gl.TEXTURE_2D, this.#explTexture);
        this.#gl.uniform1i(this.#shaderInfo.TexImageLoc, 3);

        for (let i = 0; i < this.#tempExplosionArr.length; i++){
            if (this.#tempExplosionArr[i].isActive()){
                this.#gl.uniform1f(this.#shaderInfo.timeLoc, this.#tempExplosionArr[i].getTime());
                this.#gl.uniformMatrix4fv(this.#shaderInfo.ModelMatLoc, false, this.#tempExplosionArr[i].getMatrix());
                this.#gl.drawElements(this.#gl.TRIANGLES, this.#sphere.getIndexCount(), this.#gl.UNSIGNED_SHORT, 0);
            }
        }

        for (let i = 0; i < this.#permanentExplosionArr.length; i++){
            this.#gl.uniform1f(this.#shaderInfo.timeLoc, this.#permanentExplosionArr[i].getTime());
            this.#gl.uniformMatrix4fv(this.#shaderInfo.ModelMatLoc, false, this.#permanentExplosionArr[i].getMatrix());
            this.#gl.drawElements(this.#gl.TRIANGLES, this.#sphere.getIndexCount(), this.#gl.UNSIGNED_SHORT, 0);
        }
    }
    createExplosion(worldPos, scale, permanent = false, enlarging=false, maxScale = null){
        //asteroid scale is from 0.05 to 0.3
        const explScale = scale * 6;//manually calculated to give good explosion size
        if (!permanent)
            this.#tempExplosionArr.push(new Explosion(worldPos, explScale));
        else
            this.#permanentExplosionArr.push(new Explosion(worldPos, explScale, permanent, enlarging, maxScale));
    }
}

class Explosion{
    #position;
    #translationMat = glMatrix.mat4.create();
    #time = 0;
    #scale;//how big the explosion is: ast explosions should diminish over time before disappearing
    #active = true;
    #alwaysActive;
    #diminishThresh = 1.0;//how long before explosion should get smaller and start to disappear
    #scaleDiminishRate;

    //only should be used for Star Destroyer Final Explosions
    #ShipFinalExpl;
    #scaleEnlargeRate;
    #maxScale;
    constructor(pos, size, permanent=false, enlarging=false, maxSize = null){
        this.#position = glMatrix.vec3.clone(pos);
        this.#scale = size;
        this.#scaleDiminishRate = size * 0.5;

        this.#alwaysActive = permanent;
        this.#ShipFinalExpl = enlarging;
        this.#maxScale = maxSize;
        this.#scaleEnlargeRate = this.#maxScale / 2.5;

        this.#updateMatrix();
    }
    getMatrix(){return this.#translationMat;}
    getTime(){return this.#time;}
    isActive(){return this.#active;}
    update(deltaTime){
        if (this.#scale < 0.1 && !this.#ShipFinalExpl){
            this.#active = false;
            return;
        }

        if (this.#active){
            this.#time = (this.#time + deltaTime) % 100;
            //Only for Final Ship Explosion
            if (this.#ShipFinalExpl && this.#scale < this.#maxScale){
                this.#scale = this.#scale + (deltaTime * this.#scaleEnlargeRate);
            }
            else if (this.#time >= this.#diminishThresh && !this.#alwaysActive){//permament explosion shouldn't diminish
                this.#scale = this.#scale - (deltaTime * this.#scaleDiminishRate);
            }
            this.#updateMatrix();
        }

    }
    #updateMatrix(){
        glMatrix.mat4.fromTranslation(this.#translationMat, this.#position);
        glMatrix.mat4.scale(this.#translationMat, this.#translationMat, [this.#scale, this.#scale, this.#scale]);
    }


}

function initExplosionShaders(gl){
    const VS = `#version 300 es
        precision highp float;
        layout (location = 0) in vec3 Pos;
        layout (location = 1) in vec3 Normal;
        layout (location = 2) in vec2 aTexCoord;
        uniform mat4 uViewMatrix;
        uniform mat4 uProjMatrix;
        uniform mat4 modelMatrix;
        uniform float time;

        out vec2 TexCoords;
        out float noise;

        vec3 mod289(vec3 x){
            return x - floor(x * (1.0 / 289.0)) * 289.0;
        }

        vec4 mod289(vec4 x){
            return x - floor(x * (1.0 / 289.0)) * 289.0;
        }

        vec4 permute(vec4 x){
            return mod289(((x*34.0)+10.0)*x);
        }

        vec4 taylorInvSqrt(vec4 r){
            return 1.79284291400159 - 0.85373472095314 * r;
        }

        vec3 fade(vec3 t) {
            return t*t*t*(t*(t*6.0-15.0)+10.0);
        }

        // Classic Perlin noise, periodic variant
        float pnoise(vec3 P, vec3 rep){
            vec3 Pi0 = mod(floor(P), rep); // Integer part, modulo period
            vec3 Pi1 = mod(Pi0 + vec3(1.0), rep); // Integer part + 1, mod period
            Pi0 = mod289(Pi0);
            Pi1 = mod289(Pi1);
            vec3 Pf0 = fract(P); // Fractional part for interpolation
            vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
            vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
            vec4 iy = vec4(Pi0.yy, Pi1.yy);
            vec4 iz0 = Pi0.zzzz;
            vec4 iz1 = Pi1.zzzz;

            vec4 ixy = permute(permute(ix) + iy);
            vec4 ixy0 = permute(ixy + iz0);
            vec4 ixy1 = permute(ixy + iz1);

            vec4 gx0 = ixy0 * (1.0 / 7.0);
            vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
            gx0 = fract(gx0);
            vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
            vec4 sz0 = step(gz0, vec4(0.0));
            gx0 -= sz0 * (step(0.0, gx0) - 0.5);
            gy0 -= sz0 * (step(0.0, gy0) - 0.5);

            vec4 gx1 = ixy1 * (1.0 / 7.0);
            vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
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

        float turbulence( vec3 p ) {
            float w = 30.0;
            float t = -0.5;
            for (float f = 1.0 ; f <= 10.0 ; f++ ){
                float power = pow( 2.0, f );
                t += abs( pnoise( vec3( power * p ), vec3( 10.0, 10.0, 10.0 ) ) / power );
            }
            return t;
        }

        void main() {
            TexCoords = aTexCoord;
            float scaleTime = time * 0.2;

            /*
            // get a turbulent 3d noise using the normal, normal to high freq
            noise = 10.0 *  -.10 * turbulence( .5 * Normal );
            // get a 3d noise using the position, low frequency
            float b = 5.0 * pnoise( 0.05 * Pos, vec3( 50.0 ) );
            // compose both noises
            float displacement = - 10. * noise + b;
            //float displacement = 0.0;
            */
            noise = turbulence(0.5 * Normal + scaleTime);
            float b = 0.2 * pnoise( 0.05 * Pos + vec3(2.0 * scaleTime), vec3( 100.0 ));
            float displacement = noise + b;
            
            //noise = pnoise(0.9 * Pos + scaleTime, vec3(100.0));
            //float displacement = noise;

            // move the position along the normal and transform it
            vec3 newPosition = Pos + Normal * displacement;
            gl_Position = uProjMatrix * uViewMatrix * modelMatrix * vec4(newPosition, 1.0);
        }
        `;
    const FS = `#version 300 es
        precision highp float;
        in vec2 TexCoords;
        in float noise;
        uniform sampler2D tExplosion;

        float random( vec3 scale, float seed){
            return fract( sin( dot( gl_FragCoord.xyz + seed, scale ) ) * 43758.5453 + seed ) ;
        }

        out vec4 fragColor;
        void main() {
            // get a random offset
            float r = 0.01 * random( vec3( 12.9898, 78.233, 151.7182 ), 0.0 );
            // lookup vertically in the texture, using noise and offset
            // to get the right RGB colour
            vec2 tPos = vec2( 0, noise + r );
            //vec2 tPos = vec2(0.0, r);
            vec4 color = texture(tExplosion, tPos);

            //vec3 color = vec3(TexCoords * ( 1. - 2. * noise ), 0.0);
            fragColor = vec4(color.rgb, 1.0 );
        }
        `;

    const shader = initShaderProgram(gl, VS, FS);
    return {
        program: shader,
        posLoc: 0,
        normalLoc: 1,
        texLoc: 2,
        timeLoc: gl.getUniformLocation(shader, "time"),
        ProjMatLoc: gl.getUniformLocation(shader, "uProjMatrix"),
        ViewMatLoc: gl.getUniformLocation(shader, "uViewMatrix"),
        ModelMatLoc: gl.getUniformLocation(shader, "modelMatrix"),
        TexImageLoc: gl.getUniformLocation(shader, "tExplosion"),
    }

}

export {ExplosionManager};
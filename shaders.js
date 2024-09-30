
// Initialize a shader program, so WebGL knows how to draw our data
function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  // Create the shader program

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  // If creating the shader program failed, alert

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert(
      `Unable to initialize the shader program: ${gl.getProgramInfoLog(
        shaderProgram
      )}`
    );
    return null;
  }

  return shaderProgram;
}

// creates a shader of the given type, uploads the source and compiles it.
function loadShader(gl, type, source) {
  const shader = gl.createShader(type);

  // Send the source to the shader object

  gl.shaderSource(shader, source);

  // Compile the shader program

  gl.compileShader(shader);

  // See if it compiled successfully

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(
      `An error occurred compiling the shaders: ${gl.getShaderInfoLog(shader)}`
    );
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}



//-------------------------------------------------------------------------
//NO DEFAULT PRECISION VALUE SPECIFIED FOR WEBGL FRAG SHADERS: MUST USE HIGHP, LOWP, ...

// Vertex shader program
const vsSource = `#version 300 es
in vec4 aVertexPosition;
in vec2 aTextureCoord;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

out highp vec2 vTextureCoord;

void main() {
  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * aVertexPosition;
  //vTextureCoord = aTextureCoord;
  //flip the y texture coord in shader since the image is stored flipped in bottom up orientation
  vTextureCoord = vec2(aTextureCoord.x, 1.0 - aTextureCoord.y);
}
`;
const fsSource = `#version 300 es
in highp vec2 vTextureCoord;

uniform sampler2D uSampler;
out highp vec4 fragColor;

void main() {
  fragColor = texture(uSampler, vTextureCoord);
  //gl_FragColor = texture2D(uSampler, vTextureCoord);
}
`;

//Small Shaders for the bounding box lines visualization
const VSLines = `#version 300 es
layout (location = 0) in vec3 Pos;

uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

void main() {
  gl_Position = uProjectionMatrix * uViewMatrix * vec4(Pos,1.0);
}
`;
const FSLines = `#version 300 es
out highp vec4 fragColor;
void main() {
  fragColor = vec4(1.0,1.0,1.0,1.0);//plain white for all lines
}
`;


//Star Destroyer Model Shaders
const starDestVertexShader = `#version 300 es
in vec4 aVertexPosition;
in vec3 aNormal;
in vec2 aTextureCoord;

uniform mat4 uModelMatrix;
uniform mat4 uLocalMeshMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat4 lightSpaceMatrix;

uniform mat3 normalMatrix;

out highp vec2 vTextureCoord;
out highp vec3 Normal;
out highp vec3 WorldPos;
out highp vec4 LightSpacePos;

void main() {
  Normal = normalMatrix * aNormal;

  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * uLocalMeshMatrix * aVertexPosition;
  WorldPos = vec3(uModelMatrix * uLocalMeshMatrix * aVertexPosition);
  LightSpacePos = lightSpaceMatrix * vec4(WorldPos, 1.0);
  
  /*
  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * uLocalMeshMatrix * offset;
  WorldPos = vec3(uModelMatrix * uLocalMeshMatrix * offset);
  LightSpacePos = lightSpaceMatrix * vec4(WorldPos, 1.0);
  */
  
  //flip the y texture coord in shader since the image is stored flipped in bottom up orientation
  vTextureCoord = vec2(aTextureCoord.x, 1.0 - aTextureCoord.y);
}
`;
const starDestFragmentShader = `#version 300 es
precision highp float;//sets all floats to highp by default(required for webgl glsl shaders)

in highp vec2 vTextureCoord;
in highp vec3 Normal;
in highp vec3 WorldPos;
in highp vec4 LightSpacePos;

//material parameters
uniform sampler2D albedoMap;
uniform sampler2D normalMap;
uniform highp float roughness;
uniform highp float metallic;
uniform highp float ao;//ambient occlusion

uniform highp vec4 baseColor;

//sunlight dir
uniform highp vec3 lightDir;
uniform sampler2D shadowMap;

uniform highp vec3 camPos;

out highp vec4 fragColor;
const highp float PI = 3.14159265359;
// ----------------------------------------------------------------------------
// Easy trick to get tangent-normals to world-space to keep PBR code simplified.
// Don't worry if you don't get what's going on; you generally want to do normal 
// mapping the usual way for performance anyways; I do plan make a note of this 
// technique somewhere later in the normal mapping tutorial.
vec3 getNormalFromMap(){
    vec3 tangentNormal = texture(normalMap, vTextureCoord).xyz * 2.0 - 1.0;

    vec2 origTexCoord = vec2(vTextureCoord.x, 1.0 - vTextureCoord.y);
    //vec2 origTexCoord = vTextureCoord;

    vec3 Q1  = dFdx(WorldPos);
    vec3 Q2  = dFdy(WorldPos);
    vec2 st1 = dFdx(origTexCoord);
    vec2 st2 = dFdy(origTexCoord);

    if (st1.x == 0.0 || st2.y == 0.0){
      return normalize(Normal);
    }

    vec3 N   = normalize(Normal);
    vec3 T  = normalize(Q1*st2.t - Q2*st1.t);
    vec3 B  = -normalize(cross(N, T));
    //vec3 B  = normalize(-Q1*st2.s + Q2*st1.s);
    mat3 TBN = mat3(T, B, N);

    return normalize(TBN * tangentNormal);
}

float ShadowCalculation(vec4 fragPosLightSpace){
    // perform perspective divide
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    // transform to [0,1] range
    projCoords = projCoords * 0.5 + 0.5;
    // get closest depth value from light's perspective (using [0,1] range fragPosLight as coords)
    float closestDepth = texture(shadowMap, projCoords.xy).r; 
    // get depth of current fragment from light's perspective
    float currentDepth = projCoords.z;

    //Check if the projCoords are outiside the sides of the frustum (no shadow)
    if (projCoords.x > 1.0 || projCoords.x < 0.0)
      return 0.0;

    if (projCoords.y > 1.0 || projCoords.y < 0.0)
      return 0.0;

    if (projCoords.z > 1.0)//check is object is behing the far plane of the light Matrix (no shadow)
      return 0.0;

    // check whether current frag pos is in shadow
    //float bias = max(0.05 * (1.0 - dot(Normal, lightDir)), 0.005); 
    float bias = 0.05;
    //float bias = 0.1;
    

    float shadow = currentDepth - bias > closestDepth  ? 1.0 : 0.0;

    return shadow;
}

// ----------------------------------------------------------------------------
void main() {
  vec3 albedo = pow(texture(albedoMap, vTextureCoord).rgb, vec3(2.2)) * vec3(baseColor);
  //vec3 albedo = texture(albedoMap, vTextureCoord).rgb * vec3(baseColor);
  vec3 N = getNormalFromMap();
  //vec3 N = texture(normalMap, vTextureCoord).xyz;

  
  //----------------Non PBR sole diffuse and ambinet light based on normal vector (not map)
  float gamma = 2.2;
  vec3 diffuseColor = pow(texture(albedoMap, vTextureCoord).rgb, vec3(gamma));
  //vec3 diffuseColor = pow(texture(normalMap, vTextureCoord).rgb, vec3(gamma));

  vec3 lightColor = vec3(1.0);

  float ambientStrength = 0.3;
  vec3 ambient1 = ambientStrength * lightColor * diffuseColor * vec3(baseColor);

  vec3 Norm = normalize(Normal);
  float diff = max(dot(Norm, -lightDir), 0.0);
  //float diff = max(dot(N, -lightDir), 0.0);
  //vec3 diffuse = 0.5 * diff*lightColor * texture(albedoMap, vTextureCoord).rgb * vec3(baseColor);
  vec3 diffuse = 6.0 * diff*lightColor * diffuseColor * vec3(baseColor);

  float shadow = ShadowCalculation(LightSpacePos);

  //specular component
  float specularStrength = 0.5;
  vec3 viewDir = normalize(camPos - WorldPos);
  vec3 reflectDir = reflect(-lightDir, Norm);
  float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
  vec3 specular = specularStrength * spec * lightColor * diffuseColor * vec3(baseColor);

  vec3 result = (1.0 - shadow) * (diffuse + specular) + ambient1;
  result = pow(result, vec3(1.0/gamma));

  fragColor = vec4(result, 1.0);

  //fragColor = vec4(Normal * 0.5 + 0.5, 1.0);
  //fragColor = vec4(Norm * 0.5 + 0.5, 1.0);
  //fragColor = vec4(N * 0.5 + 0.5, 1.0);
  //fragColor = vec4(texture(normalMap, vTextureCoord).rgb * 2.0 - 1.0, 1.0);
  //fragColor = texture(normalMap, vTextureCoord);


  //----ORIGINAL VERSION, NO LIGHTING
  //fragColor = texture(albedoMap, vTextureCoord) * baseColor;
  //fragColor = vec4(pow(texture(normalMap, vTextureCoord).xyz * 2.0 - 1.0, vec3(gamma)), 1.0);
  
}
`;

//***------------------------------------------------------**********
//INSTANCED SHADER FOR MESHES

const instanceVS = `#version 300 es
precision highp float;

in vec4 aVertexPosition;
in vec3 aNormal;
in vec2 aTextureCoord;
//INSTANCED MATRICES
layout (location = 3) in mat4 modelMatrix;
layout (location = 7) in mat3 normalMatrix;

uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat4 lightSpaceMatrix;

out highp vec2 vTextureCoord;
out highp vec3 Normal;
out highp vec3 WorldPos;
out highp vec4 LightSpacePos;
void main() {
  Normal = normalMatrix * aNormal;

  gl_Position = uProjectionMatrix * uViewMatrix * modelMatrix * aVertexPosition;
  WorldPos = vec3(modelMatrix * aVertexPosition);
  LightSpacePos = lightSpaceMatrix * vec4(WorldPos, 1.0);
  

  /*
  gl_Position = uProjectionMatrix * uViewMatrix * offset;
  WorldPos = vec3(offset);
  LightSpacePos = lightSpaceMatrix * vec4(WorldPos, 1.0);
  */
  vTextureCoord = vec2(aTextureCoord.x, 1.0 - aTextureCoord.y);
}
`;



//***$$$ Cubemap Skybox Vertex and Fragment Shaders $$$***/
const vsSkybox = `#version 300 es
in vec4 aPos;

uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

out highp vec3 TexCoords;

void main() {
    //TexCoords = vec3(aPos);
    //TexCoords = vec3(aPos.xy, -aPos.z);
    TexCoords = vec3(aPos.x, aPos.y, -aPos.z);
    vec4 pos = uProjectionMatrix * uViewMatrix * aPos;
    gl_Position = pos.xyww;
}
`;
const fsSkybox = `#version 300 es
in highp vec3 TexCoords;
out highp vec4 fragColor;

uniform samplerCube skybox;

void main(){
    fragColor = texture(skybox, TexCoords);
}
`;

export {initShaderProgram, vsSource, fsSource, vsSkybox, fsSkybox, starDestVertexShader, starDestFragmentShader,
  instanceVS, VSLines, FSLines
};


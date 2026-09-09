// To explicitly match the letter casing of this API with the incoming requests.
global.toCamelCase = function(str){
  if(!str) return null;
  
  return str.toLowerCase().replace(/[-_ ]+(.)/g, (_, char) => char.toUpperCase());
}
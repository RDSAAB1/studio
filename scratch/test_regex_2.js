
const regex = /(?<!\.)\b0+(?=[0-9])/g;
console.log("'0' -> ", '0'.replace(regex, ''));
console.log("'05' -> ", '05'.replace(regex, ''));
console.log("'005' -> ", '005'.replace(regex, ''));
console.log("'5.01' -> ", '5.01'.replace(regex, ''));
console.log("'10 + 0' -> ", '10 + 0'.replace(regex, ''));
console.log("'10 + 05' -> ", '10 + 05'.replace(regex, ''));

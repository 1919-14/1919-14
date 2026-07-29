import fs from "fs";

function generateSVG(theme) {

    const bg = theme === "dark"
        ? "#0A101F"
        : "#FFFFFF";

    const text = theme === "dark"
        ? "#E5E9F5"
        : "#111827";

    const grid = theme === "dark"
        ? "#2B3245"
        : "#D1D5DB";

    const accent = "#7C3AED";

    return `
<svg xmlns="http://www.w3.org/2000/svg"
     width="500"
     height="500"
     viewBox="0 0 500 500">

<rect width="500" height="500"
      rx="20"
      fill="${bg}" />

<text
x="250"
y="45"
font-size="26"
font-family="Segoe UI"
font-weight="bold"
text-anchor="middle"
fill="${text}">
Developer Activity Radar
</text>

<circle
cx="250"
cy="250"
r="170"
stroke="${grid}"
stroke-width="2"
fill="none"/>

<circle
cx="250"
cy="250"
r="120"
stroke="${grid}"
stroke-width="2"
fill="none"/>

<circle
cx="250"
cy="250"
r="70"
stroke="${grid}"
stroke-width="2"
fill="none"/>

<line
x1="250"
y1="80"
x2="250"
y2="420"
stroke="${grid}"/>

<line
x1="80"
y1="250"
x2="420"
y2="250"
stroke="${grid}"/>

<polygon
points="
250,120
350,180
330,320
170,320
150,180"
fill="${accent}"
fill-opacity="0.35"
stroke="${accent}"
stroke-width="4"/>

<circle
cx="250"
cy="250"
r="6"
fill="${accent}"/>

</svg>
`;
}

fs.mkdirSync("assets", { recursive: true });

fs.writeFileSync(
    "assets/radar-dark.svg",
    generateSVG("dark")
);

fs.writeFileSync(
    "assets/radar-light.svg",
    generateSVG("light")
);

console.log("Radar SVGs generated.");

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const mascotPath = path.join(rootDir, "src-tauri/icons/mascot-raw.png");
const masterPngPath = path.join(rootDir, "src-tauri/icons/icon-1024.png");
const iconsDir = path.join(rootDir, "src-tauri/icons");
const tempIconsetDir = path.join(rootDir, "src-tauri/icons/ilc.iconset");
const publicIconPath = path.join(rootDir, "public/app-icon.png");

if (!fs.existsSync(mascotPath)) {
  console.error("Mascot raw file not found at:", mascotPath);
  process.exit(1);
}

console.log("🎨 Generando squircle master icon para macOS (1024x1024)...");

const jxaScript = `
ObjC.import('AppKit');
ObjC.import('Foundation');

var srcPath = "${mascotPath}";
var outPath = "${masterPngPath}";
var logo = $.NSImage.alloc.initWithContentsOfFile(srcPath);

function hexColor(hex, alpha) {
  if (alpha === undefined) alpha = 1.0;
  var r = parseInt(hex.slice(1, 3), 16) / 255.0;
  var g = parseInt(hex.slice(3, 5), 16) / 255.0;
  var b = parseInt(hex.slice(5, 7), 16) / 255.0;
  return $.NSColor.colorWithRedGreenBlueAlpha(r, g, b, alpha);
}

var canvasSize = $.NSMakeSize(1024, 1024);
var img = $.NSImage.alloc.initWithSize(canvasSize);

img.lockFocus;
var ctx = $.NSGraphicsContext.currentContext;
ctx.imageInterpolation = $.NSImageInterpolationHigh;

var shadow = $.NSShadow.alloc.init;
shadow.shadowOffset = $.NSMakeSize(0, -20);
shadow.shadowBlurRadius = 28.0;
shadow.shadowColor = $.NSColor.colorWithCalibratedWhiteAlpha(0.0, 0.38);

ctx.saveGraphicsState;
shadow.set;
var squircleRect = $.NSMakeRect(100, 100, 824, 824);
var squirclePath = $.NSBezierPath.bezierPathWithRoundedRectXRadiusYRadius(squircleRect, 185, 185);
hexColor("#0e1522").set;
squirclePath.fill;
ctx.restoreGraphicsState;

ctx.saveGraphicsState;
squirclePath.addClip;
var grad = $.NSGradient.alloc.initWithStartingColorEndingColor(hexColor("#0e1522"), hexColor("#1c2536"));
grad.drawInRectAngle(squircleRect, 90.0);

var glowGrad = $.NSGradient.alloc.initWithStartingColorEndingColor(
  hexColor("#0284c7", 0.18),
  hexColor("#0284c7", 0.0)
);
glowGrad.drawFromCenterRadiusToCenterRadiusOptions(
  $.NSMakePoint(512, 512), 10,
  $.NSMakePoint(512, 512), 400,
  0
);

var groundGrad = $.NSGradient.alloc.initWithStartingColorEndingColor(
  $.NSColor.colorWithCalibratedWhiteAlpha(1.0, 0.04),
  $.NSColor.colorWithCalibratedWhiteAlpha(1.0, 0.0)
);
groundGrad.drawInRectAngle($.NSMakeRect(100, 100, 824, 250), 90.0);

ctx.restoreGraphicsState;

ctx.saveGraphicsState;
var strokePath = $.NSBezierPath.bezierPathWithRoundedRectXRadiusYRadius(
  $.NSMakeRect(101, 101, 822, 822), 184, 184
);
strokePath.lineWidth = 2.0;
$.NSColor.colorWithCalibratedWhiteAlpha(1.0, 0.18).set;
strokePath.stroke;
ctx.restoreGraphicsState;

var logoSize = 700;
var logoX = 512 - (logoSize / 2);
var logoY = 512 - (logoSize / 2) + 6;
var logoDestRect = $.NSMakeRect(logoX, logoY, logoSize, logoSize);
var logoSrcRect = $.NSMakeRect(0, 0, logo.size.width, logo.size.height);

ctx.saveGraphicsState;
var logoShadow = $.NSShadow.alloc.init;
logoShadow.shadowOffset = $.NSMakeSize(0, -10);
logoShadow.shadowBlurRadius = 18.0;
logoShadow.shadowColor = $.NSColor.colorWithCalibratedWhiteAlpha(0.0, 0.45);
logoShadow.set;

logo.drawInRectFromRectOperationFraction(
  logoDestRect,
  logoSrcRect,
  $.NSCompositingOperationSourceOver,
  1.0
);
ctx.restoreGraphicsState;

img.unlockFocus;

var tiffData = img.TIFFRepresentation;
var rep = $.NSBitmapImageRep.imageRepsWithData(tiffData).objectAtIndex(0);
var pngData = rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $());
pngData.writeToFileAtomically(outPath, true);
`;

const tempJsPath = path.join(rootDir, "scripts/.temp_render.js");
fs.writeFileSync(tempJsPath, jxaScript, "utf8");

try {
  execSync(`osascript -l JavaScript "${tempJsPath}"`, { stdio: "inherit" });
} finally {
  if (fs.existsSync(tempJsPath)) {
    fs.unlinkSync(tempJsPath);
  }
}

console.log("🛠️ Generando icon.icns para macOS con iconutil...");
const sizes = [
  { name: "icon_16x16.png", size: 16 },
  { name: "icon_16x16@2x.png", size: 32 },
  { name: "icon_32x32.png", size: 32 },
  { name: "icon_32x32@2x.png", size: 64 },
  { name: "icon_128x128.png", size: 128 },
  { name: "icon_128x128@2x.png", size: 256 },
  { name: "icon_256x256.png", size: 256 },
  { name: "icon_256x256@2x.png", size: 512 },
  { name: "icon_512x512.png", size: 512 },
  { name: "icon_512x512@2x.png", size: 1024 },
];

if (fs.existsSync(tempIconsetDir)) {
  fs.rmSync(tempIconsetDir, { recursive: true, force: true });
}
fs.mkdirSync(tempIconsetDir, { recursive: true });

for (const s of sizes) {
  const dest = path.join(tempIconsetDir, s.name);
  if (s.size === 1024) {
    fs.copyFileSync(masterPngPath, dest);
  } else {
    execSync(`sips -z ${s.size} ${s.size} "${masterPngPath}" --out "${dest}" > /dev/null`);
  }
}

const icnsDest = path.join(iconsDir, "icon.icns");
execSync(`iconutil -c icns "${tempIconsetDir}" -o "${icnsDest}"`);
fs.rmSync(tempIconsetDir, { recursive: true, force: true });

console.log("🖼️ Generando íconos PNG requeridos por macOS / Tauri...");
execSync(`sips -z 512 512 "${masterPngPath}" --out "${path.join(iconsDir, "icon.png")}" > /dev/null`);
execSync(`sips -z 256 256 "${masterPngPath}" --out "${path.join(iconsDir, "128x128@2x.png")}" > /dev/null`);
execSync(`sips -z 128 128 "${masterPngPath}" --out "${path.join(iconsDir, "128x128.png")}" > /dev/null`);
execSync(`sips -z 64 64 "${masterPngPath}" --out "${path.join(iconsDir, "64x64.png")}" > /dev/null`);
execSync(`sips -z 32 32 "${masterPngPath}" --out "${path.join(iconsDir, "32x32.png")}" > /dev/null`);

console.log("🌐 Generando favicon web...");
execSync(`sips -z 256 256 "${masterPngPath}" --out "${publicIconPath}" > /dev/null`);

console.log("✅ Íconos de macOS listos y limpios.");

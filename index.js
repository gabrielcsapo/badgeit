const fs = require('fs');
const opentype = require('opentype.js');
const defaults = require('lodash.defaultsdeep');
const defaultFont = fs.readFileSync(__dirname + '/fonts/OpenSans-Bold.ttf');

function text(message, options) {
	const { font, offsetX, paddingX, paddingY, fontSize } = options;

	var scaleFactor = fontSize / font.unitsPerEm;
	var heightInUnits = font.charToGlyph('E');
	heightInUnits.getPath();
	heightInUnits = heightInUnits.yMax;
	var heightInPixels = Math.round(heightInUnits * scaleFactor);

	var widthInUnits = font
		.stringToGlyphs(message)
		.reduce((w, glyph) => w + glyph.advanceWidth, 0);
	var widthInPixels = Math.round(widthInUnits * scaleFactor);
	var textPath = font
		.getPath(message, paddingX + offsetX, heightInPixels + paddingY, fontSize)
		.toSVG(1)
		.replace(/\.0 /g, ' '); //Pack it tighter by removing unused decimal places

	return {
		width: (paddingX * 2) + widthInPixels,
		height: (paddingY * 2) + heightInPixels,
		textPath: textPath
	};
}

module.exports = function badgeit(options = {}) {
	return new Promise(function(resolve, reject) {
		let font;

		if (options.text && options.text.length !== 2) {
			return reject(new Error('text should contain an array of two string elements'));
		}

		if (options.fontPath) {
			try {
				font = opentype.loadSync(options.fontPath);
			} catch(ex) {
				return reject(new Error('font could not be loaded'));
			}
		} else {
			const fontBuffer = defaultFont.buffer.slice(defaultFont.byteOffset, defaultFont.byteOffset + defaultFont.byteLength);
			font = opentype.parse(fontBuffer);
		}

		const values = defaults(options, {
			font,
			text: ['Hello', 'World'],
			fontSize: 11,
			colors: {
				left: '#555',
				right: '#4c1',
				font: '#fff',
				shadow: '#010101'
			},
			paddingX: 6,
			paddingY: 6,
			offsetX: 0
		});

		const rightText = text(values.text[0], values);
		const leftText = text(values.text[1], Object.assign(values, {
			offsetX: rightText.width,
		}));

		const width = rightText.width + leftText.width;
		const height = rightText.height;

		return resolve(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}">
          <defs>
              <linearGradient id="glow" x2="0" y2="100%">
                  <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
                  <stop offset="1" stop-opacity=".1"/>
              </linearGradient>
              <mask id="mask">
                  <rect width="${width}" height="${height}" rx="3" fill="#fff"/>
              </mask>
              <g id="text">
                  ${rightText.textPath}
                  ${leftText.textPath}
              </g>
          </defs>

          <g mask="url(#mask)">
              <rect fill="${values.colors.left}" x="0" y="0" width="${rightText.width}" height="${height}"/>
              <rect fill="${values.colors.right}" x="${rightText.width}" y="0" width="${width}" height="${height}"/>
              <rect fill="url(#glow)" x="0" y="0" width="${width}" height="${height}"/>
          </g>
          <g fill="${values.colors.font}">
              <use x="0" y="1" fill="${values.colors.shadow}" fill-opacity=".3" xlink:href="#text"/>
              <use x="0" y="0" xlink:href="#text"/>
          </g>
      </svg>`);
	});
};

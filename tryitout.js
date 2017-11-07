const { name, description } = require('./package.json');

module.exports = {
	title: name,
	description: description,
	nav: {
		Source: 'https://github.com/gabrielcsapo/badgeit',
	},
	body: [{
		type: 'code',
		title: 'Simple example',
		subtitle: 'Passing an array with two values changes the text',
		value: `
        const badge = require('badgeit');
        badge({ text: ['coverage', '72%' ], colors: { right: '#caa300' }})
          .then((html) => console.html(html))
          .catch((ex) => console.log(ex.toString()));
      `
	}, {
		type: 'text',
		value: `
> The following are the defaults and their types

\`\`\`
{
	fontPath: "/OpenSans-Bold" // String
	text: ['Hello', 'World'], // Array<String, String>
	fontSize: 11, // Number
	colors: {
		left: '#555', // String
		right: '#4c1', // String
		font: '#fff', // String
		shadow: '#010101' // String
	},
	paddingX: 6, // Number
	paddingY: 6, // Number
	offsetX: 0 // Number
}
\`\`\`
		`
	}],
	output: './docs',
	externals: [
		'./dist/badgeit.min.js'
	]
};

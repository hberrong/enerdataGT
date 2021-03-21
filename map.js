// Define margin and dimensions for svg
const MARGIN = {TOP: 50, RIGHT: 50, BOTTOM: 50, LEFT: 50};
const WIDTH = 1000 - MARGIN.LEFT - MARGIN.RIGHT;
const HEIGHT = 600 - MARGIN.TOP - MARGIN.BOTTOM;
const MAX_ZOOM = 100;

const DATA_TO_FILENAME = {
	"wind": "data/energy.json",
	"geothermal": "data/geothermal2.json"
}

// Variables
var data_loaded = [];
var map_loaded = false;

// Define projection and path required for Choropleth
var projection = d3.geoAlbersUsa();
var geoGenerator = d3.geoPath().projection(projection);
var map_zoomer = d3.zoom().scaleExtent([1, MAX_ZOOM]).on("zoom", zoom_map);

// Create svg
var svg = d3.select("div#choropleth").append("svg")
	.attr("width", WIDTH + MARGIN.LEFT + MARGIN.RIGHT)
	.attr("height", HEIGHT + MARGIN.TOP + MARGIN.BOTTOM)
	.call(map_zoomer)
	.on("click", reset_zoom);
	
var map_g = svg.append("g").attr("id", "map");

var data_selectors = d3.selectAll(".data-selector").on("click", select_data);

// Position our loader
var loader = d3.select(".loader").style("top", (svg.attr("height") / 2) - 40 + "px").style("left", (svg.attr("width") / 2) - 40 + "px");

// Load map
d3.json("united_states.json").then(d => createMap(d));

function createMap(us) { 
	// Add map
	states = map_g.selectAll("path")
		.data(us.features)
		.enter()
		.append("path")
		.on("click", zoom_state)
		.attr("id", d => d.properties.NAME)
		.attr("d", geoGenerator);

	map_loaded = true;
}

function reset_zoom() {
	states.classed("selected", false);
	svg.transition()
		.duration(400)
		.call(map_zoomer.transform, d3.zoomIdentity);
}

// https://observablehq.com/@d3/zoom-to-bounding-box?collection=@d3/d3-zoom
function zoom_state(state, idx, ele) {
	const [[x1, y1], [x2, y2]] = geoGenerator.bounds(state);
	d3.event.stopPropagation();	// Prevent SVG from zooming out
	states.classed("selected", false);				// Clear previous selection
	d3.select(this).classed("selected", true);		// Can highlight state with this
	svg.transition()
		.duration(400)
		.call(map_zoomer.transform, d3.zoomIdentity
			.translate(WIDTH / 2, HEIGHT / 2)		// Place in center of SVG
			.scale(Math.min(MAX_ZOOM, 0.9 / Math.max((x2 - x1) / WIDTH, (y2 - y1) / HEIGHT)))	// Zoom in on state
			.translate((x1 + x2) / -2, (y1 + y2) / -2));	// Now move zoomed in state to center
}

function zoom_map(datum, idx, ele) {
	map_g.attr("transform", d3.event.transform);
	map_g.attr("stroke-width", 1 / d3.event.transform.k);  // Make sure stroke width stays consistent

	// Now zoom in on any of our data
	for (g of data_loaded) {
		g.attr("transform", d3.event.transform);
		g.attr("stroke-width", 1 / d3.event.transform.k);  // Make sure stroke width stays consistent
	}
}

function select_data() {
	if (this.checked) {				// True if user checked it. False if user cleared check.
		load_data(this.value);		// The checkmark clicked
	} else {
		remove_data(this.value);
	}
}

function load_data(data_to_load) {
	svg.classed("loading", true);
	loader.classed("hidden", false);
	filename = DATA_TO_FILENAME[data_to_load];
	d3.json(filename).then(d => {
		var g = svg.append("g")
			.attr("id", data_to_load + "-data");

		g.selectAll("path")
			.data(d.features)
			.enter()
			.append("path")
			.attr("fill", "blue")
			.attr("stroke", "white")
			.attr("d", geoGenerator);
		
		data_loaded.push(g);
	}).catch(e => {
		console.log(filename + " not found.\n" + e);
	}).finally(() => {
		svg.classed("loading", false);
		loader.classed("hidden", true);
	});
}

function remove_data(data_to_remove) {
	var id = data_to_remove + "-data";
	idx = data_loaded.findIndex(e => e.attr("id") === id);
	if (idx >= 0) {
		d3.select("#" + id).remove();
		data_loaded.splice(idx, 1);
	}
	// console.log(data_loaded);
}
// Define margin and dimensions for svg
var margin = {top: 50, right: 50, bottom: 50, left: 50};
var width = 1000 - margin.left - margin.right;
var height = 600 - margin.top - margin.bottom;

// Create svg
var svg = d3.select("div#choropleth").append("svg")
	.attr("width", width + margin.left + margin.right)
	.attr("height", height + margin.top + margin.bottom);
	
// Define projection and path required for Choropleth
var projection = d3.geoAlbersUsa();
var geoGenerator = d3.geoPath()
	.projection(projection);

// Global variables 
var us = d3.json("united_states.json");
var energy = d3.json("energy.json");

Promise.all([us, energy])
	.then(result => ready(result[0], result[1]))
	.catch(error => console.log(`Error in executing ${error}`));

// Code to call ready() with required arguments
function ready(us, energy){
	// Create Choropleth by calling createMap() with required arguments.
	createMap(us, energy);
}

function createMap(us, energy){ 
	// Add map
	svg.append("g")
		.selectAll("path")
		.data(us.features)
		.enter().append("path")
		.attr("fill", "mediumseagreen")
		.attr("d", geoGenerator);

	svg.append( "g" )
		.selectAll( "path" )
		.data( energy.features )
		.enter()
		.append( "path" )
		.attr( "fill", "grey" )
		.attr( "stroke", "#999" )
		.attr( "d", geoGenerator );		
}

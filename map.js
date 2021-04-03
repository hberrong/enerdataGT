// Define margin and dimensions for svg
// const SVG_MARGIN = {TOP: 0, RIGHT: 0, BOTTOM: 0, LEFT: 0};
// const SVG_PADDING = {TOP: 0, RIGHT: 0, BOTTOM: 0, LEFT: 0};
const SVG_SIZE = {
	WIDTH: screen.availWidth,
	HEIGHT: screen.availHeight
};

const ZOOM_CONSTRAINTS = [1.5, 100];
const ZOOM_TRANSITION_SPEED = 750;

const DATA_TO_FILENAME = {
	"powerplants": "data/powerplants.json",
	"geothermal": "data/geothermal2.json"
}

// Variables
var data_loaded = [];
var map_loaded = false;
var map_bounds;

// Define projection and path required for Choropleth
var projection = d3.geoAlbersUsa();
var geoGenerator = d3.geoPath().projection(projection);
var map_zoomer = d3.zoom().scaleExtent(ZOOM_CONSTRAINTS).on("zoom", zoom_map);

// Create svg
var svg = d3.select("div#choropleth").append("svg")
	.call(map_zoomer)
	.on("click", reset_zoom);
const SVG_BOUNDS = svg.node().getBoundingClientRect();

	
var map_g = svg.append("g").attr("id", "map");
var states_g = map_g.append("g").attr("id", "states");
var data_selectors = d3.selectAll(".data-selector").on("click", select_data);
var new_source_icons = d3.selectAll(".new-source");
var state_selected = "United States"
var selected_year = "2020"
new_source_icons.call(d3.drag()
	.on("drag", drag_new_source)
);

// Define Tool Tip
var tip = d3.tip()
  	    .attr('class', 'd3-tip')
  	    .offset([-10, 0])
  	    .html(function(d) {
    	      return "<strong>Plant Name:</strong> <span style='color:white'>" + d.properties.plant_name + "</span><br>" + 
	        "<strong>Owned by:</strong> <span style='color:white'>" + d.properties.utility_na + "</span><br>" +
	        "<strong>Capacity:</strong> <span style='color:white'>" + d.properties.total_cap + "<strong>MW</strong>" + "</span>"
  	    })

svg.call(tip);

// Position our loader
var loader = d3.select(".loader")
	.style("top", `${(SVG_SIZE.HEIGHT / 2) - 40}px`)
	.style("left", `${(SVG_SIZE.WIDTH / 2) - 40}px`);
	
// Load map
d3.json("united_states.json").then(d => createMap(d));

// Create demand dashboard - data preparation
var demand = d3.dsv(",", "data/demand.csv", function(d) {
    return {
	year: d.YEAR,
	st: d.ST,
	state: d.STATE,
	residential: d.RESIDENTIAL,
	commercial: d.COMMERCIAL,
	industrial: d.INDUSTRIAL,
	other: d.OTHER,
	transportation: d.TRANSPORTATION,
	total: d.TOTAL
  }}) 
  .then(function (demand){

    // Get a list with all the years from the dataset
     var unique_years = new Set();
     demand.forEach(function(d) {
	  unique_years.add(d.year)
	  })  
     var years_list = [...unique_years];

    // enter code to append the year options to the dropdown
    d3.select("#selectButton")
	    .selectAll("options")
	    .data(years_list)
	    .enter()
	    .append("option")
	    .text(function(d) {return d; })
	    .attr("value", function(d) {return d; });
			  
    // event listener for the dropdown. Update demand dashboard when selection changes.
    d3.select("#selectButton")
	    .on("change", function(d) {
		selected_year = d3.select(this).property("value")
		demandDashboard(demand, state_selected, selected_year);
	    });

    // all credits to https://stackoverflow.com/questions/1759987/listening-for-variable-changes-in-javascript
    window.x = {
    aInternal: state_selected,
    aListener: function(val) {},
    set a(val) {
      this.aInternal = val;
      this.aListener(val);
    },
    get a() {
      return this.aInternal;
    },
    registerListener: function(listener) {
      this.aListener = listener;
      }
    }
    x.registerListener(function(val) {
    demandDashboard(demand, val, selected_year);
    });
  })

// Create demand dashboard - function
function demandDashboard(data, state, year){
  filtered = data.filter(function(d) {return d.year == year & d.state == state; });
  // https://www.codegrepper.com/code-examples/whatever/how+to+remove+dots+in+unordered+list+html
  d3.select("ul#demand").selectAll("*").remove()
  d3.select("ul#demand").append("li")
	.text(state)
  d3.select("ul#demand").append("li")
	.text("Total: " + filtered[0]['total'] + " MWh")
  d3.select("ul#demand").append("li")
	.text("Residential: " + filtered[0]['residential'] + " MWh")
  d3.select("ul#demand").append("li")
	.text("Commercial: " + filtered[0]['commercial'] + " MWh")
  d3.select("ul#demand").append("li")
	.text("Industrial: " + filtered[0]['industrial'] + " MWh")
  return
}

// Create energy generation dashboard
var powerplants = d3.json("data/powerplants.json").then(generation => {
    if(state_selected == "United States"){
    	var total_generation = [];
    	generation.features.forEach(function(d) {
		total_generation.push(d.properties.total_cap)
    	});
    	// https://stackoverflow.com/questions/1230233/how-to-find-the-sum-of-an-array-of-numbers
    	sum_generation = total_generation.reduce(function(a,b) {return a+b;},0)
    	sum_generation = sum_generation*365*24 // conversion to MWh
	d3.select("ul#generation").selectAll("*").remove()
  	d3.select("ul#generation").append("li")
		.text("United States")
  	d3.select("ul#generation").append("li")
		// https://stackoverflow.com/questions/2901102/how-to-print-a-number-with-commas-as-thousands-separators-in-javascript
		.text("Total Energy Produced: " + Math.round(sum_generation).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " MWh")
	d3.select("ul#generation").append("li")
		.text("Total from Renewable Sources: To Be Included")
	d3.select("ul#generation").append("li")
		.text("Total from Non-Renewable Sources: To Be Included")
	}
	// Add code later for if state_selected is a specific state
})

// Create map function
function createMap(us) { 
	// Add map
	states = states_g.selectAll("path")
		.data(us.features)
		.enter()
		.append("path")
		.on("click", zoom_state)
		.attr("id", d => d.properties.NAME)
		.attr("d", geoGenerator);

	map_loaded = true;
	map_bounds = geoGenerator.bounds(us);
	reset_zoom(0);
}

function reset_zoom(transition_speed=ZOOM_TRANSITION_SPEED) {
	const [[x1, y1], [x2, y2]] = map_bounds;
	states.classed("selected", false);
	svg.transition()
		.duration(transition_speed)
		.call(map_zoomer.transform, d3.zoomIdentity.translate(SVG_SIZE.WIDTH / 2, SVG_SIZE.HEIGHT / 2).scale(1.5).translate((x1 + x2) / -2, (y1 + y2) / -2));
}

// https://observablehq.com/@d3/zoom-to-bounding-box?collection=@d3/d3-zoom
function zoom_state(state, idx, ele) {
	var current_state = d3.select(this);
	
	// Update state_selected, which will be used to update dashboards
	state_selected = current_state['_groups'][0][0]['id'];
	window.x.a = state_selected
	
	if (current_state.classed("selected")) {
		reset_zoom();
	        state_selected = "United States"
		window.x.a = state_selected
	} else {
		const [[x1, y1], [x2, y2]] = geoGenerator.bounds(state);
		d3.event.stopPropagation();	// Prevent SVG from zooming out
		states.classed("selected", false);				// Clear previous selection
		current_state.classed("selected", true);		// Can highlight state with this
		svg.transition()
			.duration(ZOOM_TRANSITION_SPEED)
			.call(map_zoomer.transform, d3.zoomIdentity
				.translate(SVG_SIZE.WIDTH / 2, SVG_SIZE.HEIGHT / 2)		// Place in center of SVG
				.scale(Math.min(ZOOM_CONSTRAINTS[1], 0.6 / Math.max((x2 - x1) / SVG_SIZE.WIDTH, (y2 - y1) / SVG_SIZE.HEIGHT)))	// Zoom in on state
				.translate((x1 + x2) / -2, (y1 + y2) / -2));	// Now move zoomed in state to center
	}
}

function zoom_map(datum, idx, ele) {
	map_g.attr("transform", d3.event.transform);
	map_g.attr("stroke-width", 1 / d3.event.transform.k);  // Make sure stroke width stays consistent
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
		var g = map_g.append("g")
			.attr("id", data_to_load + "-data");

		g.selectAll("path")
			.data(d.features)
			.enter()
			.append("path")
			.attr("fill", "blue")
			.attr("stroke", "white")
			.attr("d", geoGenerator);
		
		// Add tooltip if dataset is "powerplants":
		if (filename == "data/powerplants.json") {
			g.selectAll("path")
			.on("mouseover", tip.show)
	    		.on("mouseout", tip.hide)
		}

		
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

function drag_new_source(datum, idx, ele) {
	
	// new_source.style("left", `${d3.event.x}px`);
	// console.log(this);
	// console.log(d3.event);
	// ele.x = d3.event.x;
	// console.log(d3.select(this));
}
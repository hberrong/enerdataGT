
const SVG_SIZE = {
	WIDTH: screen.availWidth,
	HEIGHT: screen.availHeight
};

const ZOOM_CONSTRAINTS = [1.5, 100];
const ZOOM_TRANSITION_SPEED = 750;

const DATA_TO_FILENAME = {
	"powerplants": "data/powerplants.json",
 	"wind": "data/wind_resource.geojson",
 	"geothermal": "data/geothermal.json"
}

// Variables
var data_loaded = [];
var plants = [];
var next_plant_id = 0;
var selected_plant_id = -1;
var map_loaded = false;
var map_bounds;
var usJson = {};
var plants_already_loaded = false;

var images = {};

// Fields
var plant_lat_input = d3.select("#plant_lat");
var plant_lng_input = d3.select("#plant_lng");
var plant_type_select = d3.select("#plant_type");
var plant_capacity_input = d3.select("#plant_capacity")
d3.select("#update_plant").on("click", update_plant_details);
d3.select("#reset_plant").on("click", reset_plant_details);

// Define projection and path required for Choropleth
var projection = d3.geoAlbersUsa();
var geoGenerator = d3.geoPath().projection(projection);
var map_zoomer = d3.zoom().scaleExtent(ZOOM_CONSTRAINTS).on("zoom", zoom_map);

// Create svg
var svg = d3.select("div#choropleth").append("svg")
	.attr("id", "svg_choropleth")
	.call(map_zoomer)
	.on("click", reset_zoom);
const SVG_BOUNDS = svg.node().getBoundingClientRect();

var map_g = svg.append("g").attr("id", "map");
var states_g = map_g.append("g").attr("id", "states");
var plant_g = map_g.append("g").attr("id", "plants");
var data_selectors = d3.selectAll(".data-selector").on("click", select_data);
var new_source_icons = d3.selectAll(".new-source");
var state_selected = "United States"
var selected_year = "1990"
var dragdrop_item = d3.select("body").append("div").attr("id", "dragdrop-item").style("top", "-100px").style("left", "-100px");
var dragdrop_img = dragdrop_item.append("img");
new_source_icons.call(d3.drag()
	.on("start", drag_new_source_start)
	.on("drag", drag_new_source)
	.on("end", drag_new_source_end)
);

var powerplant_toggle = d3.select("#powerplants-selector").on("click", update_displayed_plants);

//Define wind color scale
var wind_color = d3.scaleQuantize()
					.range(['#edf8e9','#c7e9c0','#a1d99b','#74c476','#31a354','#006d2c']);

//Define geothermal color scale
var geothermal_color = d3.scaleOrdinal()
.range(['#fff5f0','#fee0d2','#fcbba1','#fc9272',
'#fb6a4a','#ef3b2c','#cb181d','#a50f15','#67000d']);

// Define Tool Tip
var tip = d3.tip()
  	    .attr('class', 'd3-tip')
  	    .offset([-10, 0])
  	    .html(function(d) {
    	      return "<strong>Plant Name:</strong> <span style='color:white'>" + d.properties.plant_name + "</span><br>" + 
	        "<strong>Owned by:</strong> <span style='color:white'>" + d.properties.utility_na + "</span><br>" +
	        "<strong>Capacity:</strong> <span style='color:white'>" + Math.round(d.properties.total_cap*365*24).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "<strong> MWh</strong>" + "</span>"
  	    })

svg.call(tip);

// Position our loader
var loader = d3.select(".loader")
	.style("top", `${(SVG_SIZE.HEIGHT / 2) - 40}px`)
	.style("left", `${(SVG_SIZE.WIDTH / 2) - 40}px`);

// function to get max of array for color scales
function getMax(arr, prop) {
	var max;
	for (var i=0 ; i<arr.length ; i++) {
		if (max == null || arr[i]['properties'][prop] > max)
				max = arr[i]['properties'][prop];
		}
	return max;
}

// function to get min of array for color scales
function getMin(arr, prop) {
	var min;
	for (var i=0 ; i<arr.length ; i++) {
		if (min == null || arr[i]['properties'][prop] < min)
				min = arr[i]['properties'][prop];
		}
	return min;
}


// Load map
d3.json("united_states.json").then(d => createMap(d));


// Create demand dashboard - function
function demandDashboard(data, state, year){
  filtered = data.filter(function(d) {return d.year == year & d.state == state; });
  // https://www.codegrepper.com/code-examples/whatever/how+to+remove+dots+in+unordered+list+html

  var demtotal = parseInt(parseInt(filtered[0]['total'].replace(/,/g,""))/365/24);
  var demres = parseInt(parseInt(filtered[0]['residential'].replace(/,/g,""))/365/24);
  var demcom = parseInt(parseInt(filtered[0]['commercial'].replace(/,/g,""))/365/24);
  var demindus = parseInt(parseInt(filtered[0]['industrial'].replace(/,/g,""))/365/24);

  d3.select("ul#demand").selectAll("*").remove()
  d3.select("ul#demand").append("li")
	.text(state)
  d3.select("ul#demand").append("li")
	.text("Total: " + demtotal + " MW")
  d3.select("ul#demand").append("li")
	.text("Residential: " + demres + " MW")
  d3.select("ul#demand").append("li")
	.text("Commercial: " + demcom + " MW")
  d3.select("ul#demand").append("li")
	.text("Industrial: " + demindus + " MW")
  d3.select("ul#demand").append("li")
	.text("*Total may also include other types of use").style("font-size", "10px")
}

Promise.all([
	d3.csv("data/powerplants_sanitized.csv", row => {
		var plant_types = row["plant_types_all"].split(",");
		var plant_caps = row["plant_caps_all"].split(",").map(x => parseFloat(x));
		// console.log(plant_caps);
		var new_plant = {
			id: ++next_plant_id,
			lng: +row["longitude"],
			lat: +row["latitude"],
			plant_type: row["plant_type"],
			state: row["state_long"],
			capacity: +row["total_cap"],
			// state_short: d["state"],
			is_renewable: row["renewable"] == "true",
			name: row["plant_name"],
			sub_plants: {}
		}

		plant_types.forEach((p, idx) => {
			new_plant.sub_plants[p] = plant_caps[idx];
		});

		return new_plant;
	}),
	d3.xml("images/biomass.svg"),
	d3.xml("images/coal.svg"),
	d3.xml("images/geothermal.svg"),
	d3.xml("images/hydro.svg"),
	d3.xml("images/natural_gas.svg"),
	d3.xml("images/nuclear.svg"),
	d3.xml("images/other_fossil_gasses.svg"),
	d3.xml("images/other.svg"),
	d3.xml("images/petroleum.svg"),
	d3.xml("images/pumped_storage.svg"),
	d3.xml("images/solar.svg"),
	d3.xml("images/wind.svg"),
	d3.xml("images/wood.svg"),
]).then(([powerplant_data, biomass_svg, coal_svg, geothermal_svg, hydro_svg, natural_gas_svg, nuclear_svg, other_fossil_gasses_svg, other_svg, petroleum_svg, pumped_storage_svg, solar_svg, wind_svg, wood_svg]) => {
	plants = powerplant_data;
	d3.select("#powerplants-selector").attr("disabled", null);

	images = {
		biomass: biomass_svg.getElementsByTagName("path")[0].getAttribute("d"),
		coal: coal_svg.getElementsByTagName("path")[0].getAttribute("d"),
		geothermal: geothermal_svg.getElementsByTagName("path")[0].getAttribute("d"),
		hydro: hydro_svg.getElementsByTagName("path")[0].getAttribute("d"),
		natural_gas: natural_gas_svg.getElementsByTagName("path")[0].getAttribute("d"),
		nuclear: nuclear_svg.getElementsByTagName("path")[0].getAttribute("d"),
		other_fossil_gasses: other_fossil_gasses_svg.getElementsByTagName("path")[0].getAttribute("d"),
		other: other_svg.getElementsByTagName("path")[0].getAttribute("d"),
		petroleum: petroleum_svg.getElementsByTagName("path")[0].getAttribute("d"),
		pumped_storage: pumped_storage_svg.getElementsByTagName("path")[0].getAttribute("d"),
		solar: solar_svg.getElementsByTagName("path")[0].getAttribute("d"),
		wind: wind_svg.getElementsByTagName("path")[0].getAttribute("d"),
		wood: wood_svg.getElementsByTagName("path")[0].getAttribute("d")
	};
	// display_powerplants();
});

function update_displayed_plants() {
	if (powerplant_toggle.property("checked")) {
		display_powerplants();
	} else {
		hide_powerplants();
	}
}

function display_powerplants() {
	var plants_to_display = plants.filter(p => (p.state == state_selected) || (state_selected == "United States"));
	console.log(`Displaying ${plants_to_display.length} plants for state: ${state_selected}`)
	// Get currently displayed plants
	var selection = plant_g.selectAll("path").data(plants_to_display);
	
	// Drop plants we're not displaying anymore
	selection.exit().remove();

	selection
		.enter()
		.append("path")
		.on("click", p => {
			d3.event.stopPropagation();
			selected_plant_id = p.id;
			console.log(p);
			set_plant_details_form();
		})
		.merge(selection)
		.attr("d", p => images[p.plant_type])
		.attr("transform", d => `translate(${projection([d.lng, d.lat])})`);
}

function hide_powerplants() {
	plant_g.selectAll("path").remove();
}

// Create generation dashboard - function
function generationDashboard(data, state){
  filtered = data.features

  // Get total energy
  if(state_selected != "United States"){
	filtered = data.features.filter(function(d) {return d.properties.state_long == state; });
    	}

  var total_generation = [];
  filtered.forEach(function(d) {
	total_generation.push(d.properties.total_cap)
  });
  sum_generation = total_generation.reduce(function(a,b) {return a+b;},0)
 // sum_generation = sum_generation*365*24 // conversion to MWh

  // Get total renewable energy
  filtered_renewables = filtered.filter(function(d) {return d.properties.renewable == true; });
  var total_renewable = [];
  filtered_renewables.forEach(function(d) {
	total_renewable.push(d.properties.total_cap)
  });
  sum_renewable = total_renewable.reduce(function(a,b) {return a+b;},0)
  //sum_renewable = sum_renewable*365*24 // conversion to MWh

  // Get total non-renewable energy
  filtered_nonrenewables = filtered.filter(function(d) {return d.properties.renewable == false; });
  var total_nonrenewable = [];
  filtered_nonrenewables.forEach(function(d) {
	total_nonrenewable.push(d.properties.total_cap)
  });
  sum_nonrenewable = total_nonrenewable.reduce(function(a,b) {return a+b;},0)
  //sum_nonrenewable = sum_nonrenewable*365*24 // conversion to MWh

  // Add to the dashboard
  d3.select("ul#generation").selectAll("*").remove()
  d3.select("ul#generation").append("li")
	.text(state)
  d3.select("ul#generation").append("li")
	.text("Total Energy Produced: " + Math.round(sum_generation).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " MW")
  d3.select("ul#generation").append("li")
	.text("Total from Renewable Sources: " + Math.round(sum_renewable).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " MW")
  d3.select("ul#generation").append("li")
	.text("Total from Non-Renewable Sources: " + Math.round(sum_nonrenewable).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " MW")
}

// Create map function
function createMap(us) { 
	usJson = us;

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
	reset_zoom(0)
	
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
	window.state_listener.a = state_selected
	
	if (current_state.classed("selected")) {
		reset_zoom();
	    state_selected = "United States"
		window.state_listener.a = state_selected
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

			// set input domain for color scale
			set_color_domain(d,data_to_load)

		g.selectAll("path")
			.data(d.features)
			.enter()
			.append("path")
			.style("fill", function(d) {
				//Get data value
				var value = d.properties.capacity_mw;

				if (value) {
					//If value exists…
					return wind_color(value);
				} else {
					//If value is undefined…
					return "#ccc";
				}

			})
			//.attr("stroke", "white")
			.attr("d", geoGenerator);

    		// Add tooltip if dataset is "powerplants":
		if (filename == "data/powerplants.json") {
			g.selectAll("path")
			.on("mouseover", tip.show)
	    		.on("mouseout", tip.hide)
				.on('click', () => console.log("click 2"));
		}

		data_loaded.push(g);
	}).catch(e => {
		console.log(filename + " not found.\n" + e);
	}).finally(() => {
		svg.classed("loading", false);
		loader.classed("hidden", true);
	});
}

function set_color_domain(d,data_to_load){
	if (data_to_load == "wind"){
		return wind_color.domain([
			getMax(d.features,'capacity_mw'),
			getMin(d.features,'capacity_mw')
		]);
	} else if (data_to_load == "geothermal"){
		return geothermal_color.domain([
			'>15','10-15','5-10','4-5','3-4','2-3','1-2','0.5-1','0.1-0.5','<0.1'
		]);

	}
}

function load_plants(data_to_load) {
	svg.classed("loading", true);
	loader.classed("hidden", false);
	filename = DATA_TO_FILENAME[data_to_load];

	d3.json(filename).then(d => {
		var g = map_g.append("g")
			.attr("id", data_to_load + "-data");

	g.selectAll("path")
		.data(d.features)
		.enter()
		.append("image")
		.attr('d',geoGenerator)
		.attr('xlink:href',function(d) {return get_image(d.properties.capacity_b)})
		.attr("transform", function(d)
		{ return "translate(" + projection(d.geometry.coordinates) + ")"; })
		.attr("width",10)
		.attr("height",10)
		.on("click", () => console.log("Click"));

		data_loaded.push(g);
	}).catch(e => {
		console.log(filename + " not found.\n" + e);
	}).finally(() => {
		svg.classed("loading", false);
		loader.classed("hidden", true);
	});
}

function get_image(capacity_b) {
	// get the plant type as the string before the "=" of
	// the capacity_b property
	if (capacity_b !== null) {
		var plant = capacity_b.split("=")[0].trim().split(" ").join("_")
		//console.log(plant)
		return 'images/' + plant + '.png'
	}
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

function drag_new_source_start(datum, idx, ele) {
	src = d3.select(this);
	bnds = this.getBoundingClientRect();
	dragdrop_img.attr("src", src.attr("src")).attr("width", bnds.width).attr("height", bnds.height);
	dragdrop_item.datum(src.attr("alt").toLowerCase())
	evtSrc = d3.event.sourceEvent;
	dragdrop_item.style("left", `${evtSrc.clientX - bnds.width/2}px`).style("top", `${evtSrc.clientY - bnds.height/2}px`)
}

function drag_new_source(datum, idx, ele) {
	evtSrc = d3.event.sourceEvent;
	dragdrop_item.style("left", `${evtSrc.clientX - dragdrop_img.attr("width")/2}px`).style("top", `${evtSrc.clientY - dragdrop_img.attr("height")/2}px`)
}

function drag_new_source_end(datum, idx, ele) {
	mouse_to_svg_coords = d3.mouse(map_g.node())
	lat_lng = projection.invert(mouse_to_svg_coords)

	dragdrop_item.style("left", "-100px").style("top", "-100px");
	create_new_plant(lat_lng, dragdrop_item.datum());
}

function create_new_plant(lat_lng, plant_type) {
	var state_selected = get_state_for_lat_lng(lat_lng);
	var new_plant = undefined;
	if (state_selected) {
		new_plant = {
			id: ++next_plant_id,
			lng: lat_lng[0],
			lat: lat_lng[1],
			plant_type: plant_type,
			state: get_state_for_lat_lng(lat_lng),
			capacity: 0,
			sub_plants: {},
			is_renewable: true,				// TODO: Fix this so it's not always true
			name: `New Plant (#${next_plant_id})`
		}

		selected_plant_id = next_plant_id;

		plants.push(new_plant);
		// console.log(new_plant);

		update_displayed_plants();

		// console.log(plants);

		set_plant_details_form();
	} else {
		window.alert("Invalid location for new plant");
	}
	return new_plant;
}

function set_plant_details_form() {
	var current_plant = plants.find(p => p.id == selected_plant_id);
	// console.log(`Looking for id ${selected_plant_id}`);
	// console.log(current_plant);

	plant_lat_input.property("value", current_plant.lat);
	plant_lng_input.property("value", current_plant.lng);
	plant_type_select.property("value", current_plant.plant_type);
	plant_capacity_input.property("value", current_plant.capacity);
}

function update_plant_details() {
	d3.event.preventDefault();

	current_plant = plants.find(p => p.id == selected_plant_id);
	// var current_plant = plants[idx];
	current_plant.lat = parseFloat(plant_lat_input.property("value"));
	current_plant.lng = parseFloat(plant_lng_input.property("value"));
	current_plant.plant_type = plant_type_select.property("value");
	current_plant.capacity = parseFloat(plant_capacity_input.property("value"));
	// console.log(plants);
	update_displayed_plants();
	createPlots(demand, generation, plants, state_selected, selected_year); // update plot
}

function reset_plant_details() {
	d3.event.preventDefault();
	set_plant_details_form();
}

function get_mouse_as_svg_coords() {
	return d3.mouse(map_g.node());
}

function get_lat_lng_for_svg_coords(x_y_pos) {
	return projection.invert(x_y_pos);
}

function get_svg_coords_for_lat_lng(lat_lng) {
	return projection(lat_lng);
}

function get_state_for_mouse_pos() {
	pos = get_mouse_as_svg_coords();
	return get_state_for_position(pos);
}

function get_state_for_position(x_y_pos) {
	lat_lng = get_lat_lng_for_svg_coords(x_y_pos);
	return get_state_for_lat_lng(lat_lng);
}

function get_state_for_lat_lng(lat_lng) {
	for (const state of usJson.features) {
		if (d3.geoContains(state, lat_lng)) {
			return state.properties.NAME;
		}
	}

	return false;
}

// Load demand and current generation data with Promise.all
Promise.all([
	d3.dsv(",", "data/demand.csv", function(d) {
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
	  }}),
	d3.json("data/powerplants_cleaned.geojson")
]).then(function(data) {
	//console.log(plants);
	demand = data[0];
	generation = data[1];

	// Get a list with all the years from the dataset
	var unique_years = new Set();
	demand.forEach(function(d) {
	 unique_years.add(d.year)
	 })  
	var years_list = [...unique_years];

	// initialize graph
	//demandDashboard(demand, "United States", "1990");
	//generationDashboard(generation, "United States");
	createPlots(demand, generation, plants, "United States", "1990");

   // enter code to append the year options to the dropdown
   d3.select("#selectButton")
	   .selectAll("options")
	   .data(years_list)
	   .enter()
	   .append("option")
	   .text(function(d) {return d; })
	   .attr("value", function(d) {return d; });
			 
   // event listener for the dropdown. Update dashboards and plots when selection changes.
	d3.select("#selectButton")
		.on("change", function(d) {
			selected_year = d3.select(this).property("value")
			//demandDashboard(demand, state_selected, selected_year);
			//generationDashboard(generation, state_selected);
			createPlots(demand, generation, plants, state_selected, selected_year);
	   });

   // all credits to https://stackoverflow.com/questions/1759987/listening-for-variable-changes-in-javascript 
	 window.state_listener = {
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
	 state_listener.registerListener(function(val) {
	   //demandDashboard(demand, val, selected_year);
	   //generationDashboard(generation, val);
	   createPlots(demand, generation, plants, val, selected_year);
   });
}).catch(function(error) {
	console.log(error)
});

// Define margins/size for data viz
var bar_margin = {top: 50, right: 20, bottom: 100, left: 50},
w_bar = 300,
h_bar = 100;

// Append svg for bar chart sub plot
var svg_plot = d3.select("div#data-viz").append("svg")
	.attr("id", "barchart")
	.attr("width", w_bar + bar_margin.right + bar_margin.left)
	.attr("height", h_bar + bar_margin.bottom + bar_margin.top)
	.append("g")
	.attr("transform", "translate(" + bar_margin.left + "," + bar_margin.top + ")");

function createPlots(demand, generation, plants, state, year) {
	noBarChart();
	svg_plot.style("display", "block");

	// filter DEMAND for the year and state // 
	filtered_dem = demand.filter(function(d) {return d.year == year & d.state == state; });
	const filtered_dem_data = filtered_dem[0];

	// Get TOTAL energy for current and new capacity
	if(state_selected != "United States"){
		filtered_gen = generation.features.filter(function(d) {return d.properties.state_long == state; });
		new_gen = plants.filter(function(d) {return d.state == state; });
	} else {
		filtered_gen = generation.features;
		new_gen = plants;
	}

	// TOTAL current capacity
	var total_generation = [];
	filtered_gen.forEach(function(d) {
		total_generation.push(d.properties.total_cap)
	});
	sum_generation = total_generation.reduce(function(a,b) {return a+b;},0)
	//sum_generation = sum_generation*365*24 // conversion to MWh

	// TOTAL new capacity
	var new_total_generation = [];
	new_gen.forEach(function(d) {
		new_total_generation.push(d.capacity)
	});
	new_sum_generation = new_total_generation.reduce(function(a,b) {return a+b;},0)
	// new_sum_generation = new_sum_generation*365*24 // conversion to MWh

	// Get total current renewable energy
	filtered_renewables = filtered_gen.filter(function(d) {return d.properties.renewable == true; });
	var total_renewable = [];
	filtered_renewables.forEach(function(d) {
		total_renewable.push(d.properties.total_cap)
	});
	sum_renewable = total_renewable.reduce(function(a,b) {return a+b;},0)
	// sum_renewable = sum_renewable*365*24 // conversion to MWh

	// Get total new renewable energy
	new_filtered_renewables = new_gen.filter(function(d) {return d.is_renewable == true; });
	var new_total_renewable = [];
	new_filtered_renewables.forEach(function(d) {
		new_total_renewable.push(d.capacity)
	});
	new_sum_renewable = new_total_renewable.reduce(function(a,b) {return a+b;},0)
	// new_sum_renewable = new_sum_renewable*365*24 // conversion to MWh

	// Get total current non-renewable energy
	filtered_nonrenewables = filtered_gen.filter(function(d) {return d.properties.renewable == false; });
	var total_nonrenewable = [];
	filtered_nonrenewables.forEach(function(d) {
		total_nonrenewable.push(d.properties.total_cap)
	});
	sum_nonrenewable = total_nonrenewable.reduce(function(a,b) {return a+b;},0)
	// sum_nonrenewable = sum_nonrenewable*365*24 // conversion to MWh

	// Get total new non-renewable energy
	new_filtered_nonrenewables = new_gen.filter(function(d) {return d.is_renewable == false; });
	var new_total_nonrenewable = [];
	new_filtered_nonrenewables.forEach(function(d) {
		new_total_nonrenewable.push(d.capacity)
	});
	new_sum_nonrenewable = new_total_nonrenewable.reduce(function(a,b) {return a+b;},0)
	// new_sum_nonrenewable = new_sum_nonrenewable*365*24 // conversion to MWh

	// create array for both energy and demand data - note: all data is in MWh
	const demand_data = {
		label: "Energy Demand in " + filtered_dem_data.year,
		year: filtered_dem_data.year,
		total: (parseInt(filtered_dem_data.total.replace(/,/g,""))/365/24/1000)
	},
	graph_data = [{
		label: "Current",
		total: sum_generation/1000, // capacity data is in GW for easier viewing
		Renewable: (sum_renewable/1000), // capacity data is in GW for easier viewing
		Nonrenewable: (sum_nonrenewable/1000) // capacity data is in GW for easier viewing
	 	}, {
		label: "New",
		total: (new_sum_generation/1000), // capacity data is in GW for easier viewing
		Renewable: (new_sum_renewable/1000), // capacity data is in GW for easier viewing
		Nonrenewable: (new_sum_nonrenewable/1000) // capacity data is in GW for easier viewing
	}],
	label_info = {
		state: filtered_dem_data.state,
		year: filtered_dem_data.year
	},
	keys = d3.keys(graph_data[0]).slice(2);
	
	var stacked = d3.stack().keys(keys)(graph_data)
		.map(d => (d.forEach(v => v.key = d.key), d));

	// define scales
	var colors = d3.scaleOrdinal()
		.domain(keys)
		.range(["#577590", "#f9844a"]),
	x_scale = d3.scaleLinear()
		.domain([0, d3.max(graph_data, (function (d) {
			return d.total;
			}))])
		.range([0, w_bar]),
	y_scale = d3.scaleBand()
		.domain(graph_data.map(function (d) {
			return d.label;}))
		.range([h_bar, 0])
		.padding(0.1);

	// stacked bar graph reference: https://bl.ocks.org/Andrew-Reid/0aedd5f3fb8b099e3e10690bd38bd458
	var bars = svg_plot.selectAll(".stack")
		.data(stacked)
		.enter()
		.append("g")
		.attr("class", "stack")
		.style("fill", d => colors(d.key));

	bars.selectAll("rect")
		.data(function(d) { return d; })
		.enter()
		.append("rect")
		  .attr("x", d => x_scale(d[0]))
		  .attr("y", d => y_scale(d.data.label))
		  .attr("width", d => x_scale(d[1]) - x_scale(d[0]))
		  .attr("height", y_scale.bandwidth());

	// append axes and titles
	svg_plot.append("g")
		.attr("class", "y axis")
		.call(d3.axisLeft(y_scale));

	svg_plot.append("g")
		.attr("class", "x axis")
		.attr("transform", "translate(0, " + (h_bar) + ")")
		.call(d3.axisBottom()
			.scale(x_scale)
			.tickSize(-h_bar));
	
	// add demand line to plot
	svg_plot.append("g")
		.attr("class", "line")
		.append("line")
		.attr("id","demand_line")
		.attr("x1", function(d) {return x_scale(demand_data.total); })
		.attr("y1", 0)
		.attr("x2", function(d) {return x_scale(demand_data.total); })
		.attr("y2", (h_bar));

	// add legend
	svg_plot.append("text")
		.attr("id","legend_demand")
		.attr("class", "label")
		.attr("x", (w_bar - bar_margin.left - bar_margin.right)/2 + bar_margin.left - 10)
		.attr("y", h_bar + bar_margin.top*1.75)
		.style("text-anchor", "middle")
		.text("Energy Demand in " + label_info.year)

	svg_plot.append("g")
		.attr("class", "line")
		.append("line")
		.attr("id","legend_line")
		.attr("x1", (w_bar - bar_margin.left - bar_margin.right)/2.5 - 10)
		.attr("y1", h_bar + bar_margin.top*1.65)
		.attr("x2", (w_bar/1.5 - bar_margin.left - bar_margin.right)/2 - 10)
		.attr("y2", h_bar + bar_margin.top*1.65);

	var legend = svg_plot.append("g")
		.attr("id", "legend")
		.attr("class", "label")
		.attr("text-anchor", "end")
		.selectAll("g")
		.data(keys.slice())
		.enter().append("g")
	
	legend.append("rect")
		.attr("x", function(d, i) {return (bar_margin.left - bar_margin.right) + i*2.15*bar_margin.left})
		.attr("y", h_bar + bar_margin.top*1.15)
		.attr("width", 19)
		.attr("height", 15)
		.attr("fill", colors);
  
	legend.append("text")
		.attr("x", function(d, i) {return (w_bar - bar_margin.left - bar_margin.right)/2 + i*2.5*bar_margin.left})
		.attr("y", h_bar + bar_margin.top*1.4)
		.text(function(d) { return d; });

	svg_plot.append("text")
		.attr("class", "axis_label")
		.attr("id","x_axis_label")
		.attr("text-anchor", "middle")
		.attr("x", (w_bar - bar_margin.left - bar_margin.right)/2 +bar_margin.left/2)
		.attr("y", h_bar + bar_margin.top/1.5)
		.text("Energy Capacity (GW)");

	svg_plot.append("text")    
		.attr("class", "chart_title")
		.attr("id","chart_title")
		.attr("x", (w_bar - bar_margin.left - bar_margin.right)/2 + bar_margin.left/2.5)
		.attr("y", 0 - bar_margin.top/2)
		.style("text-anchor", "middle")
		.text("New and Current Energy Capacity for " + label_info.state)
		.style("font-size", "15px");
};

// Function to remove bar chart
function noBarChart() {
	// remove svg elements and hide
	svg_plot.selectAll("*").remove()
		.style("display", "none");;

	svg_plot.selectAll("x_axis_label").remove();
}

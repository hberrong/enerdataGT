
const SVG_SIZE = {
	WIDTH: screen.availWidth,
	HEIGHT: screen.availHeight
};

const ZOOM_CONSTRAINTS = [1.5, 100];
const ZOOM_TRANSITION_SPEED = 750;

const DATA_TO_FILENAME = {
	"solar":"data/nevada.json",
 	"wind": "data/wind_cleaned.json",
 	"geothermal": "data/geothermal_cleaned.json"
}

// Variables
var data_loaded = [];
var plants = [];
var demand = [];
var next_plant_id = 0;
var selected_plant_id = -1;
var map_bounds;
var usJson = {};
var images = {};

// Fields
var plant_lat_input = d3.select("#plant_lat");
var plant_lng_input = d3.select("#plant_lng");
var plant_type_select = d3.select("#plant_type");
var plant_size_select = d3.select("#plant_size");
var plant_capacity_input = d3.select("#plant_capacity")
d3.select("#update_plant").on("click", update_plant_details);
d3.select("#reset_plant").on("click", reset_plant_details);
d3.select("#delete_plant").on("click", delete_plant);

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
var plant_g = map_g.append("g").attr("id", "plants").style("z-index","100");
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
var greens = d3.interpolateGreens;
var wind_color = d3.scaleSequential(greens);

//Define solar color scale
var oranges = d3.interpolateOranges;
var solar_color = d3.scaleSequential(oranges);

//Define geothermal color scale
// var geothermal_color = d3.scaleOrdinal()
// .range(['#fff5f0','#fee0d2','#fcbba1','#fc9272',
// '#fb6a4a','#ef3b2c','#cb181d','#a50f15','#67000d']);
var reds = d3.interpolateReds;
var geothermal_color = d3.scaleSequential(reds);

var map_color_scales = {wind:wind_color, solar:solar_color, geothermal:geothermal_color}

// Define Tool Tip
var plant_tooltip = d3.tip()
  	    .attr('class', 'd3-tip')
  	    .attr('id', 'plant-tip')
  	    .offset([-10, 0])
  	    .html(p => {
    	      return "<strong>Plant Name:</strong> <span style='color:white'>" + p.name + "</span><br>" +
	          "<strong>Capacity:</strong> <span style='color:white'>" + Math.round(p.capacity) + " MW" + "</span>";
  	    })
svg.call(plant_tooltip);

var new_source_tooltip = d3.tip()
	.attr("class", "d3-tip")
	.offset([-10, 0])
	.html(p => console.log(p));


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
d3.json("united_states.json").then(mapData => createMap(mapData));

// Load other data
Promise.all([
	d3.csv("data/powerplants_fixed.csv", row => {
		var plant_types = row["plant_types_all"].split(",");
		var plant_caps = row["plant_caps_all"].split(",").map(x => parseFloat(x));
		// console.log(plant_caps);
		var new_plant = {
			id: ++next_plant_id,
			lng: +row["longitude"],
			lat: +row["latitude"],
			plant_type: row["plant_type"],
			plant_size: "small",
			state: row["state_long"],
			capacity: +row["total_cap"],
			// state_short: d["state"],
			is_renewable: row["renewable"] == "TRUE",
			name: row["plant_name"],
			sub_plants: {}
		}

		plant_types.forEach((p, idx) => {
			new_plant.sub_plants[p] = plant_caps[idx];
		});

		return new_plant;
	}),

  d3.csv("data/loadForecast.csv", function(d) {
		return {
		year: d.YEAR,
		st: d.ST,
		state: d.STATE,
		total: parseInt(d.TOTAL.replace(/,/g,""))
	  }}),

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
]).then(([powerplant_data, demandData, biomass_svg, coal_svg, geothermal_svg, hydro_svg, natural_gas_svg, nuclear_svg, other_fossil_gasses_svg, other_svg, petroleum_svg, pumped_storage_svg, solar_svg, wind_svg, wood_svg]) => {

  	plants = powerplant_data; // new capacity, will update with addition of new plants
	d3.select("#powerplants-selector").attr("disabled", null);

	demand = demandData;
	generation = powerplant_data.filter(f => f); // current capacity, will not change

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
	}
	// display_powerplants();
	createPlots(demand, generation, plants, "United States"); // initialize data visualization on national level

 }).catch(function(error) {
	 console.log(error)
 });

function update_displayed_plants() {
	if (powerplant_toggle.property("checked")) {
		display_powerplants();
	} else {
		hide_powerplants();
	}
}

function display_powerplants() {
	var plants_to_display = get_plants_in_state(state_selected);
	console.log(`Displaying ${plants_to_display.length} plants for state: ${state_selected}`)
	// Get currently displayed plants
	var selection = plant_g.selectAll("path").data(plants_to_display);

	// Drop plants we're not displaying anymore
	selection.exit().remove();

	selection.enter()
		.append("path")
		.on("click", p => {
			d3.event.stopPropagation();
			selected_plant_id = p.id;
			console.log(p);
			set_plant_details_form();
		})
		.on("mouseover", plant_tooltip.show)
		.on("mouseout", plant_tooltip.hide)
		.merge(selection)
		.attr("d", p => images[p.plant_type])
		.attr("transform", d => `translate(${projection([d.lng, d.lat])}) scale(0.5)`);	// TODO: Update translate to center the image at lat long. Currently top-left is at position
}

function hide_powerplants() {
	plant_g.selectAll("path").remove();
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
	// remove data
 var ps = d3.selectAll("#powerplants-selector").property('checked',false)
 ps.property('checked',false)

 var ss = d3.selectAll("#solar-selector")
 ss.property('checked',false)
 remove_data(ss.property('value'))

 var ws = d3.selectAll("#wind-selector")
 ws.property('checked',false)
 remove_data(ws.property('value'))

 var gs = d3.selectAll("#geothermal-selector")
 gs.property('checked',false)
 remove_data(gs.property('value'))

	//hide selectors when map zoomed out
	d3.selectAll("#data-selectors")
	.transition()
	.duration(transition_speed)
		.style('display', 'none')

	d3.selectAll("#new-sources")
	.transition()
	.duration(transition_speed)
		.style('display', 'none')

	d3.selectAll("#plant-details")
	.transition()
	.duration(transition_speed)
		.style('display', 'none')

	//display title when zoomed out
	d3.selectAll("#title")
		.transition()
		.duration(transition_speed)
		.style('display','block')

	const [[x1, y1], [x2, y2]] = map_bounds;
	states.classed("selected", false);
	svg.transition()
		.duration(transition_speed)
		.call(map_zoomer.transform, d3.zoomIdentity.translate(SVG_SIZE.WIDTH / 2, SVG_SIZE.HEIGHT / 2).scale(1.1).translate((x1 + x2) / -2, (y1 + y2) / -2));
}


// https://observablehq.com/@d3/zoom-to-bounding-box?collection=@d3/d3-zoom
function zoom_state(state, idx, ele) {
	var current_state = d3.select(this);
	var b = d3.selectAll("#data-selectors")

	// remove title when zoomed in
d3.selectAll("#title")
	.transition()
	.delay(ZOOM_TRANSITION_SPEED)
	.style('display','none')

	// show the data_selectors, new_sources, and plant_details now that a state is selected
	d3.selectAll("#data-selectors")
	.transition()
	.delay(ZOOM_TRANSITION_SPEED)
		.style('display', 'block')

	d3.selectAll("#new-sources")
	.transition()
	.delay(ZOOM_TRANSITION_SPEED)
		.style('display', 'block')

	d3.selectAll("#plant-details")
	.transition()
	.delay(ZOOM_TRANSITION_SPEED)
		.style('display', 'block')

	// Update state_selected, which will be used to update dashboards
	state_selected = current_state.datum().properties.NAME;


	if (current_state.classed("selected")) {
		reset_zoom();
		state_selected = "United States";
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

	update_displayed_plants();
	updatePlots(demand, generation, plants, state_selected);
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

//add graident legend
defs = svg.append("g").attr("id","gradient-group").append("defs");

function load_data(data_to_load) {
	svg.classed("loading", true);
	loader.classed("hidden", false);
	//filename = DATA_TO_FILENAME[data_to_load];
	filename = "data/state_data/" + state_selected + ".json"
	d3.json(filename).then(d => {
		var g = map_g.append("g")
			.attr("id", data_to_load + "-data")
			.style("z-index","-1")

			// set input domain for color scale
			set_color_domain(d,data_to_load)

		g.selectAll("path")
			.data(d.features)
			.enter()
			.append("path")
			.style("fill", function(d) {
				//Get data value
				//var value = d.propertiescapacity_mw;
				var value = d.properties[data_to_load]
				if (value) {
					//If value exists…
					color_scale = get_color_scale(data_to_load)
					return color_scale(value);
				} else {
					//If value is undefined…
					return "#ccc";
				}

			})
			.style("stroke", "none")
			.attr("d", geoGenerator)

		svg.select("#gradient-group").attr('display', 'block');
  		const linearGradient = defs.append("linearGradient")
      	.attr("id", "linear-gradient");

		  linearGradient.selectAll("stop")
				.attr("id","stop_map")
		    .data(color_scale.ticks().map((t, i, n) => ({ offset: `${100*i/n.length}%`, color: color_scale(t) })))
		    .enter().append("stop")
		    .attr("offset", d => d.offset)
		    .attr("stop-color", d => d.color);

			svg.select("#gradient-group").append("g")
				.attr("id","gradient-group-"+data_to_load)
				.append("rect")
				.attr("height",20)
				.attr("width",100)
				.attr("x",250)
				.attr("y",0)
				.style("fill","url(#linear-gradient)")
				.attr('transform' , 'rotate(270, '+300+',' +100 +') ')

			svg.select("#gradient-group-"+data_to_load)
				.append("text")
				.attr("class", "label")
				.attr("x",198)
				.attr("y",40)
				.text("High")
				.style("black")

			svg.select("#gradient-group-"+data_to_load)
				.append("text")
				.attr("class", "label")
				.attr("x",198)
				.attr("y",170)
				.text("Low")
				.style("black")

		data_loaded.push(g);

	}).catch(e => {
		console.log(filename + " not found.\n" + e);
	}).finally(() => {
		svg.classed("loading", false);
		loader.classed("hidden", true);
	});
}

//function to define the different color scales for each drag_new_source_end
function get_color_scale(data_to_load){
	return map_color_scales[data_to_load]
}


function set_color_domain(d,data_to_load){
	potential_scale = map_color_scales[data_to_load]
	c_scale = potential_scale.domain([
		  getMin(d.features,data_to_load),
			getMax(d.features,data_to_load)])
	return c_scale

	// if (data_to_load == "wind"){
	// 	 wind_d = wind_color.domain([
	// 	  getMin(d.features,data_to_load),
	// 		getMax(d.features,data_to_load)])
	// 	return wind_d
	// } else if (data_to_load == "geothermal"){
	// 	return geothermal_color.domain([
	// 		'>15','10-15','5-10','4-5','3-4','2-3','1-2','0.5-1','0.1-0.5','<0.1'
	// 	]);
	// } else if (data_to_load == "solar"){
	//   solar_d = solar_color.domain([
	//     getMin(d.features,data_to_load),
	//     getMax(d.features,data_to_load)])
  //   return solar_d
  // }
}

function remove_data(data_to_remove) {
	var id = data_to_remove + "-data";
	idx = data_loaded.findIndex(e => e.attr("id") === id);
	if (idx >= 0) {
		d3.select("#" + id).remove();
		// remove gradient legend
		d3.select("#gradient_legend").remove();
		d3.select("#gradient_text1").remove();
		d3.select("#gradient_text2").remove();
		d3.select("#linear-gradient").remove();
		data_loaded.splice(idx, 1);

		svg.select("#gradient-group-"+data_to_remove).remove(); // remove gradient legend
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
			plant_size: 'small',
			state: get_state_for_lat_lng(lat_lng),
			//capacity:0,
			sub_plants: {},
			is_renewable: true,				// TODO: Fix this so it's not always true
			name: `New Plant (#${next_plant_id})`
		}

		get_capacity(lat_lng, plant_type,new_plant.plant_size, function(c) {
			new_plant['capacity'] = parseFloat(Math.round(c*10)/10);
		  	plant_capacity_input.property("value", new_plant.capacity);})
		selected_plant_id = next_plant_id;
		plants.push(new_plant);


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

	plant_lat_input.property("value", current_plant.lat);
	plant_lng_input.property("value", current_plant.lng);
	plant_type_select.property("value", current_plant.plant_type);
	plant_size_select.property("value", current_plant.plant_size);
	//plant_capacity_input.property("value", current_plant.capacity);
}

function delete_plant() {
	d3.event.preventDefault();

	var current_plant = plants.find(p => p.id == selected_plant_id);

	var plant_index = plants.indexOf(current_plant)
	plants.splice(plant_index,1)

	//display powerplants without deleted
	display_powerplants()
	updatePlots(demand, generation, plants, state_selected);




}

function update_plant_details() {
	d3.event.preventDefault();

	current_plant = plants.find(p => p.id == selected_plant_id);

	// var current_plant = plants[idx];
	//current_plant.lat = parseFloat(plant_lat_input.property("value"));
	//current_plant.lng = parseFloat(plant_lng_input.property("value"));
	current_plant.plant_type = plant_type_select.property("value");
	current_plant.plant_size = plant_size_select.property("value");
	//current_plant.capacity = parseFloat(plant_capacity_input.property("value")*1000);

	get_capacity([current_plant.lng,current_plant.lat],current_plant.plant_type,current_plant.plant_size,function(c) {

		current_plant.capacity = parseFloat(c);
		plant_capacity_input.property("value", Math.round(c));
})

	update_displayed_plants();
	updatePlots(demand, generation, plants, state_selected); // update plot
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
	return null;
}

// Define margins/size for data viz and append svg
var line_margin = {top: 50, bottom: 60, right: 35, left: 55},
w_line = 170,
h_line = 160;

var svg_line = d3.select("div#data-viz").append("svg")
	.attr("id", "graph")
	.attr("width", w_line + line_margin.right + line_margin.left)
	.attr("height", h_line + line_margin.bottom + line_margin.top)
	.append("g")
	.attr("transform", "translate(" + line_margin.left + "," + line_margin.top + ")");

function dataPlots(demand, generation, plants, state) {
	//----------------------------DATA WRANGLING FOR GRAPH----------------------------//
	const filtered_forecast_data = demand.filter(function(d) {return d.state == state; }),
	time_conv = d3.timeParse("%Y"),
	forecast_data = [],
	circle_data = [],
	circle_years = ["2000", "2010", "2020", "2030", "2040"]//, "2049"]

	// convert forecast data for line graph
	for (let i = 0; i < filtered_forecast_data.length; i++) {
		const forecast = {
			year: time_conv(filtered_forecast_data[i].year),
			total: filtered_forecast_data[i].total/365/24/1000 // MWh to GW conversion
		}
		forecast_data.push(forecast);
	}
	// create array of data for circle points
	for (let j = 0; j < circle_years.length; j++) {
		const circle = filtered_forecast_data.find(f => f.year == circle_years[j]);
		const circle2 = {
			year: time_conv(circle.year),
			total: circle.total/365/24/1000 // MWh to GW conversion
		}
		circle_data.push(circle2);
	}
	// Get TOTAL energy for current and new capacity
	if (state_selected != "United States") {
		filtered_gen = generation.filter(function(d) {return d.state == state; });
		new_gen = plants.filter(function(d) {return d.state == state; });
	} else {
		filtered_gen = generation;
		new_gen = plants;
	}

	// TOTAL current capacity
	var total_generation = [];
	filtered_gen.forEach(function(d) {
		total_generation.push(d.capacity)
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
	filtered_renewables = filtered_gen.filter(function(d) {return d.is_renewable == true; });
	var total_renewable = [];
	filtered_renewables.forEach(function(d) {
		total_renewable.push(d.capacity)
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
	filtered_nonrenewables = filtered_gen.filter(function(d) {return d.is_renewable == false; });
	var total_nonrenewable = [];
	filtered_nonrenewables.forEach(function(d) {
		total_nonrenewable.push(d.capacity)
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

	var percent_renewable = Math.round(new_sum_renewable/(new_sum_renewable+new_sum_nonrenewable)*100*10)/10

	var svg_percent = d3.selectAll("#percent-renew").append("svg")
		.attr("class", "label")
		.append("text")
		.attr("x",130)
		.attr("y", 20)
		.style("text-anchor", "middle")
		.style("font-size", "15px")
		.style("font-weight", "700")
		.text(percent_renewable + " % Renewables");


	// create array for both energy and demand data - note: all data is originally in MWh
	const graph_data = [{
		label: "Current Capacity",
		total: sum_generation/1000, // capacity data is in GW for easier viewing
		Renewable: (sum_renewable/1000), // capacity data is in GW for easier viewing
		Nonrenewable: (sum_nonrenewable/1000) // capacity data is in GW for easier viewing
		}, {
		label: "New Capacity",
		total: (new_sum_generation/1000), // capacity data is in GW for easier viewing
		Renewable: (new_sum_renewable/1000), // capacity data is in GW for easier viewing
		Nonrenewable: (new_sum_nonrenewable/1000) // capacity data is in GW for easier viewing
	}],
	keys = d3.keys(graph_data[0]).slice(2),
	tot_scale = [graph_data[0].total, graph_data[1].total];

	for (let i = 0; i < forecast_data.length; i++) {
		tot_scale.push(forecast_data[i].total);  // add forecast totals to array for y scale
	}

	return [graph_data, keys, tot_scale, forecast_data, circle_data];
}

function createPlots(demand, generation, plants, state) {
	data = dataPlots(demand, generation, plants, state);
	const graph_data = data[0],
		keys = data[1],
		tot_scale = data[2],
		forecast_data = data[3],
		circle_data = data[4];

	//----------------------------SCALES---------------------------//
	// define forecast demand scales
	var min_date = d3.min(forecast_data, function(d) { return d.year }),
		max_date = d3.max(forecast_data, function(d) { return d.year }),
		max_tot = d3.max(tot_scale);

	// define scales
	var x_dem_scale = d3.scaleTime() // forecast line x scale for dates
			.domain([min_date, max_date])
			.range([0, w_line]),
		colors = d3.scaleOrdinal() // color scale for renewable vs non renewable
			.domain(keys)
			.range(["#0E6957", "#88FF6A"]),
		y_scale = d3.scaleLinear() // y-axis scale
			.domain([0, max_tot])
			.range([h_line, 0]),
		x_scale = d3.scaleBand() // bar graph x scale for current vs new capacity
			.domain(graph_data.map(function (d) { return d.label;}))
			.range([0, w_line])
			.padding(0.1);

	//----------------------------CAPACITY BAR GRAPH----------------------------//
	// stacked bar graph reference: https://bl.ocks.org/Andrew-Reid/0aedd5f3fb8b099e3e10690bd38bd458, https://bl.ocks.org/mbostock/3886208
	var stacked = d3.stack().keys(keys)(graph_data)
		.map(d => (d.forEach(v => v.key = d.key), d)),
	bars = svg_line.selectAll(".stack")
		.data(stacked)
		.enter()
		.append("g")
		.attr("class", "stack")
		.style("fill", d => colors(d.key))
		.selectAll("rect")
		.data(function(d) { return d; }),
	viz_tooltip = d3.tip()
		.attr("id", "graph-tooltip")
		.attr('class', 'd3-tip')
		.style('opacity', 0.3)
		.style('font-size', '14px')
		.html(function(d) {
			return d.key +" Energy<br><strong>" + Math.round( (d[1]-d[0]) / d.data.total * 100) + "%</strong> of Total Capacity";
				//+ Math.round(d[1]-d[0]) + " thousands of MW<br>";;
		});

	svg_line.call(viz_tooltip);
	bars.enter()
		.append("rect")
		.attr("class", "rect")
		.attr("x", d => x_scale(d.data.label))
		.attr("y", d => y_scale(d[1]))
		.attr("height", d => y_scale(d[0]) - y_scale(d[1]))
		.attr("width", x_scale.bandwidth())
		.on("mouseover", viz_tooltip.show)
		.on("mousemove", function(d) {
			viz_tooltip.show;
			viz_tooltip.style('top', d3.event.y - 50 + 'px');
			viz_tooltip.style('left', d3.event.x - 170 + 'px');
		})
		.on("mouseout", viz_tooltip.hide)


	//----------------------------FORECAST LINE GRAPH----------------------------//
	// create a path object for the forecast line
	var line = svg_line.selectAll(".forecast-line")
		.data([forecast_data]);

	line.enter()
		.append("path")
		.attr("id", "demand")
		.attr("class", "forecast-line")
		.attr("stroke", "white")
		.attr("stroke-width", 3)
		.attr("d", d3.line()
			.x(function(d) { return x_dem_scale(d.year); })
			.y(function(d) { return y_scale(d.total); })
			.curve(d3.curveMonotoneX))
		.attr("fill", "none");

	// append and label circles for demand line, 10 year interval
	var circle = svg_line.selectAll(".circles")
		.data(circle_data)
		.enter();
	circle.append("circle")
		.attr("class", "circles")
		.attr("r", 9)
		.attr("fill", "white")
		.attr("cx", function(d) { return x_dem_scale(d.year); })
		.attr("cy", function(d) { return y_scale(d.total); });
	circle.append("text")
		.attr("class", "year label")
		.attr("dx", function(d) { return x_dem_scale(d.year); })
		.attr("dy", function(d) { return y_scale(d.total) + 3.5; })
		.text(function(d) { return d.year.getFullYear() }) // "2010" year format
		.style("fill", 'black')
		.style("text-anchor", "middle")
		.style("font-size", "7px")
		.style("font-weight", "700");

	//----------------------------AXES---------------------------//
	svg_line.append("g") // x axis, curent/new capacity
		.attr("class", "x-axis")
		.attr("transform", "translate(0, " + (h_line) + ")")
		.call(d3.axisBottom()
			.scale(x_scale));
	svg_line.append("g") // y axis, energy (GW) or (1000s of MW)
		.attr("class", "y-axis")
		.call(d3.axisLeft(y_scale));

	//----------------------------AXES LABELS AND TITLES---------------------------//
	// add axes labels and titles
	svg_line.append("text")
		.attr("class", "axis_label")
		.attr("id","y_axis_label")
		.attr("text-anchor", "middle")
		.attr("transform", "rotate(-90)")
		.attr("x", -h_line/2)
		.attr("y", -line_margin.left/1.4)
		.text("Energy (1000s of MW)")
		.style("text-align","center");
	svg_line.append("text")
		.attr("class", "chart_title")
		.attr("id","chart_title2")
		.attr("x", (w_line)/2.15)
		.attr("y", -line_margin.top/1.5)
		.style("text-anchor", "middle")
		.text("Energy Demand and Capacity")
		.style("font-size", "15px")
		.style("text-align","center");
	svg_line.append("text")
		.attr("class", "chart_title")
		.attr("id","chart_title")
		.attr("x", (w_line)/2.15)
		.attr("y", -line_margin.top/3.5)
		.style("text-anchor", "middle")
		.text("for the " + state)
		.style("font-size", "15px")
		.style("text-align","center");

	//----------------------------LEGEND---------------------------//
	var legend_bar = svg_line.append("g") // legend for bar graph elements
		.attr("id", "legend_bar")
		.selectAll("g")
		.data(keys.slice())
		.enter();
	legend_bar.append("g")
		.append("rect")
		.attr("x", function(d, i) { return line_margin.right*1.2 - i*90; })
		.attr("y", h_line + line_margin.bottom/2.8)
		.attr("width", 12)
		.attr("height", 12)
		.attr("fill", colors);
	legend_bar.append("g")
		.append("text")
		.attr("class", "label")
		.attr("text-anchor", "left")
		.attr("x", function(d, i) { return line_margin.right*1.15 - i*90 + 17; })
		.attr("y", h_line + line_margin.bottom/2 +2)
		.text(function(d) { return d; })
		.style("font-size","10px");
	svg_line.append("line") // legend for line graph
		.attr("class", "line")
		.attr("id","legend_line")
		.attr("x1", w_line/1.8 + 20)
		.attr("y1", h_line + line_margin.bottom/1.9 - 3)
		.attr("x2",  w_line/1.8 + 50)
		.attr("y2",  h_line + line_margin.bottom/1.9 - 3)
		.attr("stroke", "white")
	svg_line.append("circle")
		.attr("id","legend_circle")
		.attr("r",8.5)
		.attr("fill", "white")
		.attr("cx", w_line/1.8 + 35)
		.attr("cy", h_line + line_margin.bottom/1.9 - 3.5);
	svg_line.append("text")
		.attr("id","legend_year")
		.attr("class", "label")
		.attr("x", w_line/1.8 + 35)
		.attr("y", h_line + line_margin.bottom/1.95)
		.style("text-anchor", "middle")
		.style("font-size", "7px")
		.style("font-weight", "700")
		.text("Year");
	svg_line.append("text")
		.attr("id","legend_demand")
		.attr("class", "label")
		.attr("x", w_line - 20)
		.attr("y",  h_line + line_margin.bottom/2 + 2)
		.style("text-anchor", "left")
		.style("font-size","10px")
		.text("Demand");
}

function updatePlots(demand, generation, plants, state) {
	data = dataPlots(demand, generation, plants, state); // retrieve the updated data
	const graph_data = data[0],
		keys = data[1],
		tot_scale = data[2],
		forecast_data = data[3],
		circle_data = data[4],
		animate = d3.transition()
			.duration(2000)
			.ease(d3.easeLinear); // set transition time and ease transition

	//----------------------------REDEFINE SCALES---------------------------//
	// redefine forecast demand scales
	var min_date = d3.min(forecast_data, function(d) { return d.year }),
		max_date = d3.max(forecast_data, function(d) { return d.year }),
		max_tot = d3.max(tot_scale);

	// redefine scales
	var x_dem_scale = d3.scaleTime() // forecast line x scale for dates
			.domain([min_date, max_date])
			.range([0, w_line]),
		colors = d3.scaleOrdinal() // color scale for renewable vs non renewable
			.domain(keys)
			.range(["#0E6957", "#88FF6A"]),
		y_scale = d3.scaleLinear() // y-axis scale
			.domain([0, max_tot])
				.range([h_line, 0]),
		x_scale = d3.scaleBand() // bar graph x scale for current vs new capacity
			.domain(graph_data.map(function (d) {
				return d.label;}))
				.range([0, w_line])
			.padding(0.1);

	//----------------------------UPDATE GRAPH---------------------------//
	// select and update bar graph
	var stacked = d3.stack().keys(keys)(graph_data)
		.map(d => (d.forEach(v => v.key = d.key), d));
	bars = svg_line.selectAll(".stack")
		.data(stacked)
		.style("fill", d => colors(d.key))
		.selectAll(".rect")
		.data(function(d) { return d; });
	bars.transition(animate)
		.attr("x", d => x_scale(d.data.label))
		.attr("y", d => y_scale(d[1]))
		.attr("height", d => y_scale(d[0]) - y_scale(d[1]))
		.attr("width", x_scale.bandwidth())

	// select and update demand graph elements
	svg_line.select(".forecast-line") // update forecast line
		.data([forecast_data])
		.transition(animate)
		.attr("d", d3.line()
			.x(function(d) { return x_dem_scale(d.year); })
			.y(function(d) { return y_scale(d.total); })
		.curve(d3.curveMonotoneX));
	svg_line.selectAll(".circles") // update year circles
		.data(circle_data)
		.transition(animate)
		.attr("cx", function(d) { return x_dem_scale(d.year); })
		.attr("cy", function(d) { return y_scale(d.total); });
	svg_line.selectAll(".year") // update year text
		.data(circle_data)
		.transition(animate)
		.attr("dx", function(d) { return x_dem_scale(d.year); })
		.attr("dy", function(d) { return y_scale(d.total) + 3.5; })
		.text(function(d) { return d.year.getFullYear() }); // "2010" year format;

	// select and update y axis
	svg_line.select(".y-axis") // select by id
		.transition(animate)
		.call(d3.axisLeft(y_scale));

	// select and update chart title

	// svg_line.select(".chart_title2") // select by id
	// 	.transition(animate)
	// 	.text("Energy Demand and Capacity")
	// 	.style("font-size", "15px");
	svg_line.select("#chart_title") // select by id
		.transition(animate)
		.text("for " + state)
		.style("font-size", "15px");

}

function get_plants_in_state(state) {
	return plants.filter(p => (p.state == state) || (state == "United States"))
}

function get_capacity(lat_lng, plant_type,plant_size,callback_fn) {
	//set filepath for state corresponding to lat_lng
		s = get_state_for_lat_lng(lat_lng)
		fileloc = "data/state_data/"
		f_name = fileloc.concat(s,".json")

	// map plant types to conversion factors for type and size
	var plant_map = {'wind':{'small':0.25,'medium':0.5,'large':1},
	'solar':{'small':1/24000,'medium':100/24000,'large':1000/24000},
	'geothermal':{'small':1,'medium':3,'large':5}}

   d3.json(f_name).then(data=>{
		 cap = data.features.find(f => d3.geoContains(f, lat_lng)).properties[plant_type];
		 c = cap*plant_map[plant_type][plant_size]
		 callback_fn(c)
	 })

 }

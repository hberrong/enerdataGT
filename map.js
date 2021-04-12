
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
  	    .offset([-10, 0])
  	    .html(p => {
    	      return "<strong>Plant Name:</strong> <span style='color:white'>" + p.name + "</span><br>" +
	          "<strong>Capacity:</strong> <span style='color:white'>" + Math.round(p.capacity) + "<strong> MW</strong>" + "</span>";
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
			is_renewable: row["renewable"] == "true",
			name: row["plant_name"],
			sub_plants: {}
		}

		plant_types.forEach((p, idx) => {
			new_plant.sub_plants[p] = plant_caps[idx];
		});

		return new_plant;
	}),

  d3.csv("data/demand.csv", function(d) {
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
	createPlots(demand, generation, plants, "United States"); // generate default plot of US

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



	const [[x1, y1], [x2, y2]] = map_bounds;
	states.classed("selected", false);
	svg.transition()
		.duration(transition_speed)
		.call(map_zoomer.transform, d3.zoomIdentity.translate(SVG_SIZE.WIDTH / 2, SVG_SIZE.HEIGHT / 2).scale(1.5).translate((x1 + x2) / -2, (y1 + y2) / -2));
}


// https://observablehq.com/@d3/zoom-to-bounding-box?collection=@d3/d3-zoom
function zoom_state(state, idx, ele) {
	var current_state = d3.select(this);
	var b = d3.selectAll("#data-selectors")


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
	createPlots(demand, generation, plants, state_selected);
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
	//filename = DATA_TO_FILENAME[data_to_load];
	filename = "data/state_data/" + state_selected + ".json"
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

			//add graident legend
			const defs = svg.append("defs");

  		const linearGradient = defs.append("linearGradient")
      	.attr("id", "linear-gradient");

		  linearGradient.selectAll("stop")
				.attr("id","stop_map")
		    .data(color_scale.ticks().map((t, i, n) => ({ offset: `${100*i/n.length}%`, color: color_scale(t) })))
		    .enter().append("stop")
		    .attr("offset", d => d.offset)
		    .attr("stop-color", d => d.color);

			svg.append("g")
				.attr("id","gradient_legend")
				.append("rect")
				.attr("height",20)
				.attr("width",100)
				.attr("x",250)
				.attr("y",0)
				.style("fill","url(#linear-gradient)")
				.attr('transform' , 'rotate(270, '+300+',' +100 +') ')

			svg.append("text")
				.attr("id","gradient_text1")
				.attr("x",195)
				.attr("y",40)
				.text("High")
				.style("black")

			svg.append("text")
				.attr("id","gradient_text2")
				.attr("x",195)
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
			new_plant['capacity'] = Math.round(c*10)/10
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

		current_plant.capacity = Math.round(c)
		plant_capacity_input.property("value", current_plant.capacity);
})

	update_displayed_plants();
	createPlots(demand, generation, plants, state_selected); // update plot
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

// Define margins/size for data viz
var bar_margin = {top: 50, right: 20, bottom: 100, left: 50},
w_bar = 300,
h_bar = 100;

var line_margin = {top: 35, right: 20, bottom: 115, left: 50},
w_line = 300,
h_line = 150;

// Append svg for capacity bar chart
var svg_plot = d3.select("div#data-viz").append("svg")
	.attr("id", "barchart")
	.attr("width", w_bar + bar_margin.right + bar_margin.left)
	.attr("height", h_bar + bar_margin.bottom + bar_margin.top)
	.append("g")
	.attr("transform", "translate(" + bar_margin.left + "," + bar_margin.top + ")");

// Append svg for demand forecast line graph
var svg_line = d3.select("div#demand-viz").append("svg")
	.attr("id", "line graph")
	.attr("width", w_bar + line_margin.right + line_margin.left)
	.attr("height", h_bar + line_margin.bottom + line_margin.top)
	.append("g")
	.attr("transform", "translate(" + line_margin.left + "," + line_margin.top + ")");

function createPlots(demand, generation, plants, state) {
	svg_line.selectAll("*").remove();

	const filtered_forecast_data = demand.filter(function(d) {return d.state == state; }),
	time_conv = d3.timeParse("%Y"),
	forecast_data = [],
	circle_data = [],
	circle_years = ["1990", "2000", "2010", "2020", "2030", "2040", "2049"]

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

	//----------------------------FORECAST LINE GRAPH----------------------------//
	// define forecast demand scales
	var min_date = d3.min(forecast_data, function(d) {
		return d.year
		})
	var max_date = d3.max(forecast_data, function(d) {
			return d.year
			})
	var max_tot = d3.max(forecast_data, function(d) {
		return d.total
		})

	var x_dem_scale = d3.scaleTime()
		.domain([min_date, max_date])
		.range([0, w_line]);

	var y_dem_scale = d3.scaleLinear()
		.domain([0, max_tot])
		.range([h_line, 0]);

	// add axes
	svg_line.append("g")
		.attr("class", "x axis")
		.attr("transform", "translate(0, " + (h_line) + ")")
		.call(d3.axisBottom()
			.ticks(5)
			.tickFormat(d3.timeFormat('%Y'))
			.scale(x_dem_scale));

	svg_line.append("g")
		.attr("class", "y axis")
		.call(d3.axisLeft(y_dem_scale))

	// create a path object for the forecast line
	svg_line.append("path")
		.datum(forecast_data)
		.attr("fill", "none")
		.attr("stroke", "grey")
		.attr("stroke-width", 1.5)
		.attr("d", d3.line()
			.x(function(d) { return x_dem_scale(d.year); })
			.y(function(d) { return y_dem_scale(d.total); })
			.curve(d3.curveMonotoneX)
			);

	// Create default capacity plot for 2020
	createCapacityPlot(demand, generation, plants, state, "2020");

	// add circles for selected years and event handler for choosing demand year
	svg_line.selectAll(".circles")
		.data(circle_data)
		.enter()
		.append("circle")
		.attr("r", 4)
		.attr("fill", "red")
		.attr("cx", function(d) { return x_dem_scale(d.year); })
		.attr("cy", function(d) { return y_dem_scale(d.total); })
		.on("mouseover", function(f) {
			createCapacityPlot(demand, generation, plants, state, f.year.getFullYear().toString());
	        d3.select(this).attr("r", 8);
		})
		.on("mouseout", function(f) {
			createCapacityPlot(demand, generation, plants, state, "2020");
	        d3.select(this).attr("r", 4);
		});

	// add axes labels and titles
	svg_line.append("text")
		.attr("class", "axis_label")
		.attr("id","x_axis_label")
		.attr("text-anchor", "middle")
		.attr("x", (w_line - line_margin.left - line_margin.right)/2 +line_margin.left/2)
		.attr("y", h_line + line_margin.bottom/3)
		.text("Year");

	svg_line.append("text")
		.attr("class", "axis_label")
		.attr("id","y_axis_label")
		.attr("text-anchor", "middle")
		.attr("transform", "rotate(-90)")
		.attr("x", -h_line/2)
		.attr("y", -line_margin.left/1.25)
		.text("Energy Demand (GW)");

	svg_line.append("text")
		.attr("class", "chart_title")
		.attr("id","chart_title")
		.attr("x", (w_line - line_margin.left - line_margin.right)/2 + line_margin.left/2.5)
		.attr("y", -line_margin.top/2.3)
		.style("text-anchor", "middle")
		.text("Energy Demand for " + state)
		.style("font-size", "15px");

	svg_line.append("text")
		.attr("class", "label")
		.attr("id","Forecast instructions")
		.attr("x", (w_line - line_margin.left - line_margin.right)/2 + line_margin.left/2.5)
		.attr("y", h_line + line_margin.bottom/2)
		.style("text-anchor", "middle")
		.style("font-size", "10 px")
		.text("Mouseover circle to compare energy demand to capacity");
}

function createCapacityPlot(demand, generation, plants, state, year) {
	svg_plot.selectAll("*").remove();

	//----------------------------FILTER DATA AND CALCULATIONS----------------------------//
	// filter DEMAND for the year and state //
	filtered_dem = demand.filter(function(d) {return d.state == state && d.year == year; });
	const filtered_dem_data = filtered_dem[0];

	// Get TOTAL energy for current and new capacity
	if(state_selected != "United States"){
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

	// create array for both energy and demand data - note: all data is in MWh
	const demand_data = {
		label: "Energy Demand in " + filtered_dem_data.year,
		year: filtered_dem_data.year,
		total: filtered_dem_data.total/365/24/1000 // MWh to GW conversion
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

	//----------------------------CAPACITY BAR GRAPH----------------------------//
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
		.style("font-size", "15px")
		.text("New and Current Energy Capacity for " + label_info.state);
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

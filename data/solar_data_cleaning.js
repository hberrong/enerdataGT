// Solar resource data from API provides average annual and monthly solar attributes from 1998-2009
// https://developer.nrel.gov/docs/solar/solar-resource-v1/
// https://developer.nrel.gov/docs/rate-limits/
// limit for API calls is 1000 requests per day

// Define API key for API call
const API_KEY = 'Ry9c6ppp6yscix0FfTSDauhlMEMf52uwCoQY2pip';

// Use lat/lon value for each state to sparsley populate USA map
d3.tsv("states.txt", function(d) {
    return d;
}).then(function(coords) {

     //console.log(coords);
     const promises = [];
     for (let i = 0; i < coords.length; i++) {   
        const lat = parseFloat(coords[i].latitude)
        const lon = parseFloat(coords[i].longitude)
        const url = `https://developer.nrel.gov/api/solar/solar_resource/v1.json?api_key=${API_KEY}&lat=${lat}&lon=${lon}`;
        const promise = fetch(url).then(res => res.json());
        promises.push(promise);
     }

    Promise.all(promises).then(responses => {
        console.log(responses); // responses is an array of all the promise results

        data = api_calls(responses); // make API calls
        //console.log(data);
        final = to_geojson(data);
        console.log(final);
        //load_data(responses) // load data for mapping

    }).catch(error => {
        console.log(error);
    });
 });
 
 // Function to make API calls
 function api_calls(promise_results) {
    const solar = [];
    for (let j = 0; j < promise_results.length; j++) {
        const loc = promise_results[j];
        const clean_data = {
            lat: loc.inputs.lat, // latitude as string
            lon: loc.inputs.lon, // longitude as string
            data: loc.outputs.avg_dni.annual // annual average DNI data for graph and calculations in kWh/m2/day
        };
        solar.push(clean_data);
    }
    return solar;
 }

// Function to data wrangle into GeoJSON format
 function to_geojson(results) {
     const feat = [];
     for (let k = 0; k < results.length; k++) {
         const ft = { 
             type: "Feature", 
             properties: { 
                data: results[k].data, // annual average DNI in kWh/m2/day
             },
             geometry: { 
                type: "Point",
                coordinates: [parseFloat(results[k].lon), parseFloat(results[k].lat)]
             }
         }
         feat.push(ft);
    }

    return {
        type: "FeatureCollection",
        features: feat
    }
 }

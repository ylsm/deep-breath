var app = {};
app.helpers = {};
app.data = {};
app.loading = {"files": 3, "loaded": 0};
app.newState = true; // only add new state to history if this is true - needed to make back button work properly
app.range = 15; // km; default range to look for monitoring stations within
app.IGNORE = -99;
app.levels = {"ambient":{}, "emissions":{}};
app.levels.ambient.fpmAvg = [10, 8, 6, 4];
app.levels.ambient.fpmPeak = [28, 20, 15, 10];
app.levels.ambient.ozoneAvg = [45, 40, 35, 30];
app.levels.ambient.ozonePeak = [63, 60, 55, 50];
app.levels.ambient.sulphur = [4, 2, 1, 0.5];
app.levels.ambient.nitrogen = [16, 12, 8, 4];
app.levels.ambient.voc = [100, 60, 40, 20];
app.levels.emissions.nox = [800, 400, 200, 100, 50];
app.levels.emissions.sox = [6000, 2000, 500, 100, 25];
app.levels.emissions.voc = [400, 200, 100, 30, 15];
app.levels.emissions.pm25 = [100, 25, 5, 1, 0.5];
app.levels.emissions.pm10 = [250, 50, 10, 5, 1];
app.levels.emissions.tpm = [1000, 250, 100, 25, 5];
app.levels.emissions.nh3 = [400, 100, 25, 5, 1];
app.levels.emissions.co = [1000, 500, 100, 50, 25];

app.start = function() {
    app.navigate("home");
}

app.showHome = function() {
    if (app.newState)
        history.pushState({"view": "home"}, null, null);
    $( '#titlebar' ).empty().append( '<h1>Deep Breath</h1>' );
    $( '#content' ).empty();
    $( '#content' ).append($( '<button>Enter Location</button>' ).click(function() { app.showSearch(); }));
}

app.showSearch = function() {
    if (app.newState)
        history.pushState({"view": "search"}, null, null);
    $( '#titlebar' ).empty().append( '<h1>Enter Location</h1>' );
    $( '#content' ).empty();
    $( '#content' ).append($( '<input type="text" id="location"></input>' ));
    $( '#content' ).append($( '<input type="text" id="range" value="' + app.range + '"></input>' ));
    $( '#content' ).append($( '<button>Go</button>' ).click(function() {
            app.findLocation($( '#location' ).val());
            app.range = parseFloat($( '#range' ).val());
        }));
}

app.findLocation = function(str, range) {
    // Note: Currently using Google Maps API to find coordinates from given address. Replace with Canadian Open Data when available.
    $.getJSON("http://maps.googleapis.com/maps/api/geocode/json?address=" + str + "&components=country:canada&sensor=false", function(json) {
        if (json.results.length == 1) {
            app.showLocation({"lat": json.results[0].geometry.location.lat, "lng": json.results[0].geometry.location.lng, "address": json.results[0].formatted_address, "range": app.range});
        } else {
            app.showSearchResults(json.results);
        }
    });
}

app.showSearchResults = function (obj) {
    if (app.newState)
        history.pushState({"view": "results", "locations":obj}, null, null);
    $( '#titlebar' ).empty().append( '<h1>Did you mean...</h1>' );
    $( '#content' ).empty();
    var ul = $( '<ul>' ).appendTo( '#content' );
    for (var i in obj) {
        ul.append($( '<li>' + obj[i].formatted_address + '</li>' ).click((function(data) {
            return function() { app.showLocation(data); };
        })({"lat":obj[i].geometry.location.lat, "lng":obj[i].geometry.location.lng, "address":obj[i].formatted_address, "range": app.range})));
    }
}

app.showLocation = function (obj) {
    if (app.newState)
        history.pushState({"view": "location", "location":obj}, null, null);
    $( '#titlebar' ).empty().append( '<h1>' + obj.address + '</h1>' );
    $( '#content' ).empty();
    var dataAmbient = app.getAmbientData(obj.lat, obj.lng, obj.range);
    if (!dataAmbient) {
        $( '#content' ).append("No monitoring stations in range");
    } else {
        var ulAmbient = $( '<ul>' ).appendTo( '#content' );
        ulAmbient.append(app.helpers.makeLi("ambient", "fpmAvg", "Average FPM", dataAmbient.fpmAvg));
        ulAmbient.append(app.helpers.makeLi("ambient", "ozoneAvg", "Average Ozone", dataAmbient.ozoneAvg));
        ulAmbient.append(app.helpers.makeLi("ambient", "sulphur", "Sulphur Dioxide", dataAmbient.sulphur));
        ulAmbient.append(app.helpers.makeLi("ambient", "nitrogen", "Nitogen Dioxide", dataAmbient.nitrogen));
        ulAmbient.append(app.helpers.makeLi("ambient", "voc", "VOCs", dataAmbient.voc));
        $( '#content' ).append( '<p>This information is the average of the data from:</p>' );
        var ulStations = $( '<ul>' ).appendTo( '#content' );
        for (var i in dataAmbient.stations) {
            ulStations.append( '<li>' + dataAmbient.stations[i].Address + '</li>' );
        }
        
    }
    var dataPollutants = app.getEmissionsPollutantsData(obj.lat, obj.lng, obj.range);
    if (!dataPollutants) {
        $( '#content' ).append("No large emitters in range");
    } else {
        var ulPollutants = $( '<ul>' ).appendTo( '#content' );
        ulPollutants.append(app.helpers.makeLi("emissions", "nox", "Total NOx Emissions", dataPollutants.nox));
        ulPollutants.append(app.helpers.makeLi("emissions", "sox", "Total SOx Emissions", dataPollutants.sox));
        ulPollutants.append(app.helpers.makeLi("emissions", "voc", "Total VOC Emissions", dataPollutants.voc));
        ulPollutants.append(app.helpers.makeLi("emissions", "pm25", "Total PM2.5 Emissions", dataPollutants.pm25));
        ulPollutants.append(app.helpers.makeLi("emissions", "pm10", "Total PM10 Emissions", dataPollutants.pm10));
        ulPollutants.append(app.helpers.makeLi("emissions", "tpm", "Total TPM Emissions", dataPollutants.tpm));
        ulPollutants.append(app.helpers.makeLi("emissions", "co", "Total CO Emissions", dataPollutants.co));
    }
}

app.getAmbientData = function (lat, lng, range) {
    var stns = [];
    for (var i in app.data.ambient) {
        var stn = app.data.ambient[i];
        if (app.helpers.getDistance(lat, lng, stn.Latitude, stn.Longitude) <= range) {
            stns.push(stn);
        }
    }
    
    if (stns.length > 0) {
        var data = {};
        data.stations = stns;
        data.fpmAvg = [];
        data.fpmPeak = [];
        data.ozoneAvg = [];
        data.ozonePeak = [];
        data.sulphur = [];
        data.nitrogen = [];
        data.voc = [];

        for (var i in stns) {
            data.fpmAvg.push(parseFloat(stns[i]['2011 Average Fine Particulate Matter (µg/m3)']));
            data.fpmPeak.push(parseFloat(stns[i]['2011 Peak Fine Particulate Matter (µg/m3)']));
            data.ozoneAvg.push(parseFloat(stns[i]['2011 Average Ozone (ppb)']));
            data.ozonePeak.push(parseFloat(stns[i]['2011 Peak Ozone (ppb)']));
            data.sulphur.push(parseFloat(stns[i]['2011 Sulphur Dioxide (ppb)']));
            data.nitrogen.push(parseFloat(stns[i]['2011 Nitrogen Dioxide (ppb)']));
            data.voc.push(parseFloat(stns[i]['2011 Volatile Organic Compounds (ppbC)']));
        }
        data.fpmAvg = app.helpers.average(data.fpmAvg);
        data.fpmPeak = app.helpers.average(data.fpmPeak);
        data.ozoneAvg = app.helpers.average(data.ozoneAvg);
        data.ozonePeak = app.helpers.average(data.ozonePeak);
        data.sulphur = app.helpers.average(data.sulphur);
        data.nitrogen = app.helpers.average(data.nitrogen);
        data.voc = app.helpers.average(data.voc);
        
        return data;
    }

    return false;
}

app.helpers.total = function (values) {
    var total = 0;
    for (var i in values) {
        if (parseFloat(values[i]) != app.IGNORE)
            total += parseFloat(values[i]);
    }
    return total;
}

app.getEmissionsPollutantsData = function (lat, lng, range) {
    var facilities = [];
    for (var i in app.data.pollutants) {
        var facility = app.data.pollutants[i];
        if (app.helpers.getDistance(lat, lng, facility.Latitude, facility.Longitude) <= range) {
            facilities.push(facility);
        }
    }
    
    if (facilities.length > 0) {
        var data = {};
        data.facilities = [];
        data.nox = [];
        data.sox = [];
        data.voc = [];
        data.pm25 = [];
        data.pm10 = [];
        data.tpm = [];
        data.nh3 = [];
        data.co = [];
        for (var i in facilities) {
            var obj = {};
            obj.name = facilities[i]['Facility Name'];
            obj.naics = facilities[i]['NAICS Name'];
            obj.nox = facilities[i]['2011 NOx Emissions (t)'];
            obj.sox = facilities[i]['2011 SOx Emissions (t)'];
            obj.voc = facilities[i]['2011 VOC Emissions (t)'];
            obj.pm25 = facilities[i]['2011 PM2.5 Emissions (t)'];
            obj.pm10 = facilities[i]['2011 PM10 Emissions (t)'];
            obj.tpm = facilities[i]['2011 VOC Emissions (t)'];
            obj.nh3 = facilities[i]['2011 NH3 Emissions (t)'];
            obj.co = facilities[i]['2011 CO Emissions (t)'];
            data.facilities.push(obj);
            
            data.nox.push(obj.nox);
            data.sox.push(obj.sox);
            data.voc.push(obj.voc);
            data.pm25.push(obj.pm25);
            data.pm10.push(obj.pm10);
            data.tpm.push(obj.tpm);
            data.nh3.push(obj.nh3);
            data.co.push(obj.co);
        }
        data.nox = app.helpers.total(data.nox);
        data.sox = app.helpers.total(data.sox);
        data.voc = app.helpers.total(data.voc);
        data.pm25 = app.helpers.total(data.pm25);
        data.pm10 = app.helpers.total(data.pm10);
        data.tpm = app.helpers.total(data.tpm);
        data.nh3 = app.helpers.total(data.nh3);
        data.co = app.helpers.total(data.co);
        return data;
    }
    return false;
}

app.helpers.average = function (values) {
    var totalNum = values.length;
    var total = 0;
    for (var i in values) {
        if (values[i] != app.IGNORE) { // if it's not an ignore value
            total += values[i];
        } else {
            totalNum -= 1;
        }
    }
    if (totalNum > 0)
        return Math.round(total / totalNum * 100) / 100;
    return "No Data";
}

// from http://www.barattalo.it/2009/12/26/decimal-degrees-conversion-and-distance-of-two-points-on-google-map/
app.helpers.getDistance = function (lat1,lon1,lat2,lon2) {
    var R = 6371; // km (change this constant to get miles)
    var dLat = (lat2-lat1) * Math.PI / 180;
    var dLon = (lon2-lon1) * Math.PI / 180; 
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180 ) * Math.cos(lat2 * Math.PI / 180 ) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c;
    return d;
}

app.helpers.makeLi = function (cat, type, text, value) {
    var level;
    if (value == "No Data") {
        level = "none";
    }
    else if (parseFloat(value) == app.IGNORE) {
        return null;
    } else {
        for (var i = 0; i < app.levels[cat][type].length; i++) {
            if (parseFloat(value) >= app.levels[cat][type][i]) {
                level = i;
                break;
            }
        }
        level = app.levels[cat][type].length;
    }
    return $( '<li class="' + cat + ' level-' + level + '">' + text + ': ' + value + '</li>' );
}

app.navigate = function (view) {
    switch(view) {
        case "home":
            app.showHome();
            break;
        case "search":
            app.showSearch();
            break;
        case "results":
            app.showSearchResults(event.state.locations);
            break;
        case "location":
            app.showLocation(event.state.location);
            break;
    }
}

app.loading.checkAllDataLoaded = function () {
    if (app.loading.loaded == app.loading.files)
        app.start();
}

window.addEventListener('popstate', function(e) {
    var view = "home";
    if (e.state)
        view = e.state.view;
    app.newState = false;
    app.navigate(view);
    app.newState = true;
});

$(function() {
    $.get('data/ambient.csv', function(data) {
        app.data.ambient = $.csv.toObjects(data, {"separator":"\t"});
        app.loading.loaded += 1;
    });
    $.get('data/emissions_pollutants.csv', function(data) {
        app.data.pollutants = $.csv.toObjects(data, {"separator":"\t"});
        app.loading.loaded += 1;
    });
    $.get('data/emissions_toxics.csv', function(data) {
        app.data.toxins = $.csv.toObjects(data, {"separator":"\t"});
        app.loading.loaded += 1;
    });
});
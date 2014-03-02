var app = {};
app.helpers = {};
app.data = {};
app.loading = {"files": 3, "loaded": 0};
app.newState = true; // only add new state to history if this is true - needed to make back button work properly
app.range = 15; // km; default range to look for monitoring stations within
app.IGNORE = -99;

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
        ulAmbient.append( '<li>Average FPM: ' + dataAmbient.fpmAvg + '</li>' );
        ulAmbient.append( '<li>Average Ozone: ' + dataAmbient.ozoneAvg + '</li>' );
        ulAmbient.append( '<li>Sulphur Dioxide: ' + dataAmbient.sulphur + '</li>' );
        ulAmbient.append( '<li>Nitrogen Dioxide: ' + dataAmbient.nitrogen + '</li>' );
        ulAmbient.append( '<li>VOCs: ' + dataAmbient.voc + '</li>' );
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
        ulPollutants.append( '<li>Total NOx Emissions: ' + dataPollutants.nox + '</li>' );
        ulPollutants.append( '<li>Total SOx Emissions: ' + dataPollutants.sox + '</li>' );
        ulPollutants.append( '<li>Total VOC Emissions: ' + dataPollutants.voc + '</li>' );
        ulPollutants.append( '<li>Total PM2.5 Emissions: ' + dataPollutants.pm25 + '</li>' );
        ulPollutants.append( '<li>Total PM10 Emissions: ' + dataPollutants.pm10 + '</li>' );
        ulPollutants.append( '<li>Total TPM Emissions: ' + dataPollutants.tpm + '</li>' );
        ulPollutants.append( '<li>Total CO Emissions: ' + dataPollutants.co + '</li>' );
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
    $.get('data/emissions_toxins.csv', function(data) {
        app.data.toxins = $.csv.toObjects(data, {"separator":"\t"});
        app.loading.loaded += 1;
    });
});
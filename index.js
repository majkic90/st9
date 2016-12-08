var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var PORT = process.env.PORT || 8080;

var moment = require('moment');
var ko = require('knockout');
var request = require("request");
var asyncForEach = require('async-foreach').forEach;
var jsdom = require('jsdom');
var fs = require('fs'),
    jsonfile = require('jsonfile');

app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
})

io.on('connection', function (socket) {
    socket.send("connect");
    socket.on('disconnect', function () {
    });
});


var configJSON = 'json/config.json',
    itemsListJSON = 'json/items.json',
    advancedSearch = 'json/advancedSearch.json',
    knifeSearchList = 'json/knifeSearchList.json'

var ifERROR = false,
    itemsNames = [],
    refreshTime = 10000;

var knifeChoices = [];
var selectedItems = [];
var testAdvanced = [];
var allItemsFromServer = [];

var euro = 1;


        jsonfile.readFile(knifeSearchList, function (err, obj) {
            if(!err){
                selectedItems = obj;
            }
        else console.log(err);
        });
         

knifeExteriorChoices = [{
        value: 0,
        name: 'Factory New',
        isSelected: true
    },
    {
        value: 1,
        name: 'Minimal Wear',
        isSelected: true
    },
    {
        value: 2,
        name: 'Field-Tested',
        isSelected: true
    },
    {
        value: 3,
        name: 'Well-Worn',
        isSelected: false
    },
    {
        value: 4,
        name: 'Battle-Scarred',
        isSelected: false
    },
];

selectedExterior = (function () {
    return ko.utils.arrayFilter(knifeExteriorChoices, function (item) {
        return item.isSelected;
    });
})();

request({
    url: "https://api.myjson.com/bins/1lf9x",
    json: true
}, function (error, response, body) {

    if (!error && response.statusCode === 200) {
    var obj = body;
    //itemi koje trazis
    itemsNames = obj;
    allItemsFromServer  =itemsNames;
    jsonfile.readFile(advancedSearch, function (err, obj) {
        obj.forEach(function (data) {
            testAdvanced.push({
                name: data.name,
                searchname: data.searchname,
                isSelected: true
            })
        })
        jsonfile.readFile(configJSON, function (err, config) {
            if (typeof config[0].sound !== "undefined" && typeof config[0].search !== "undefined" && typeof config[0].refreshTime !== "undefined") {
                refreshTime=config[0].refreshTime;

                selectedAdvanced = (function () {
                    return ko.utils.arrayFilter(testAdvanced, function (item) {
                        return item.isSelected;
                    });
                })();

                var refresh = setInterval(function () {
                    //krece na 1. sekundu da radi
					if (moment().seconds() == 6) {
						refreshFunction()
						clearInterval(refresh);
					}
				}, 100);
            }
        })
    })
    }
})


function refreshFunction() {
    asyncForEach([1], function () {
        getitemsPrice();
        var done = this.async();
        setTimeout(done, refreshTime);
    }, function done() {
        if (ifERROR) {
            setTimeout(function () {
                refreshFunction();
            }, 20000);
        }
        else {
            refreshFunction();
        }
    });
};

function getitemsPrice() {

    var searchFilter = [],
        searchString = "";

    selectedAdvanced.forEach(function (value) {
        searchFilter.push(value);
    });
    searchFilter.forEach(function (value, index) {
        if (searchFilter.length == index + 1) {
            searchString = searchString + value.searchname;
        }
        else {
            searchString = searchString + value.searchname + "%2B";
        }
    });
    if (selectedExterior.length < 1) {
        searchString = searchString + "&category_730_ItemSet%5B%5D=any&category_730_ProPlayer%5B%5D=any&category_730_StickerCapsule%5B%5D=any&category_730_TournamentTeam%5B%5D=any";
    }

    selectedExterior.forEach(function (value) {
        searchString = searchString + "&category_730_Exterior%5B%5D=tag_WearCategory" + value.value;
    });

    selectedItems.forEach(function (value) {
        searchString = searchString + "&category_730_Weapon%5B%5D=" + value;
    })

    ifERROR = false;
    request({
        url: "http://steamcommunity.com/market/search/render/?country=RS&language=english&currency=3&appid=730&start=0&count=100&query=" + searchString + "&format=json",
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
        
        var test = body.results_html;
        jsdom.env(test,
            ["http://code.jquery.com/jquery.js"],
            function (err, window) {
            var $ = window.jQuery;
            var knifes = [];
            $( ".market_listing_searchresult .market_listing_item_name" ).each(function( index ) {
            //dobiju se imena svih skinova
            knifes[index] = { "item": $( this ).text()};
            });

            knifes.forEach(function (data, index) {
                    allItemsFromServer.forEach(function (value, index) {
                        if (data.item == value.item) {
                                console.log('pojavio se');
                                io.emit('hello', { text: "http://steamcommunity.com/market/listings/730/" + encodeURIComponent(value.item), img: "", tobuy: value.autobuy });
                                $.ajax({
                                    url:"https://api.myjson.com/bins/3d1jx",
                                    type:"POST",
                                    data:'{"item":' + value.item + '}',
                                    contentType:"application/json; charset=utf-8",
                                    dataType:"json",
                                    success: function(data, textStatus, jqXHR){
                                            
                                    }
                                });     
                        }
                    })
                });
            console.log('ok');
            io.emit('alert', "ok");
            }
        );
        }

        if (response.statusCode === 429) {
            ifERROR = true;
            console.log('error');
            io.emit('alert', "error");
        }
        if (error) {
            ifERROR = true;
            console.log('error');
            io.emit('alert', "error");
        }
    });

}


http.listen(PORT, function(){
    console.log('listen' , PORT);
})
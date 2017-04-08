declare var extract: any;
declare var geodash: any;
declare var ol: any;
declare var jsts: any;
declare var $: any;

/* Components */
import { Component, OnInit, EventEmitter, ElementRef } from '@angular/core';

/* Services */
import { GeoDashServiceBus }  from 'GeoDashServiceBus';
import { GeoDashServiceCompile } from 'GeoDashServiceCompile';

@Component({
  selector: 'geodash-map-map',
  template: geodash.api.getTemplate('geodashMapMap.tpl.html')
})
export class GeoDashComponentMapMap implements OnInit {
  name = 'GeoDashComponentMapMap';

  private dashboard: any;
  private state: any;

  constructor(private element: ElementRef, private bus: GeoDashServiceBus, private compileService: GeoDashServiceCompile) {

  }

  ngOnInit(): void {
    geodash.var.components[this.name] = this; // register externally
    this.bus.listen("primary", "geodash:loaded", this.onLoaded);
    this.bus.listen("render", "geodash:changeView", this.onChangeView);
    this.bus.listen("render", "geodash:refresh", this.onRefresh);
    this.bus.listen("render", "geodash:openPopup", this.onOpenPopup);
  }

  render = (object: any, ctx: any): any => {
    return geodash.util.arrayToObject(geodash.util.objectToArray(object).map((x:any) => {
      return <any>{
        "name": x.name,
        "value": (geodash.util.isString(x.value) ? this.interpolate(x.value)(ctx) : x.value)
      };
    }));
  }

  interpolate = (template: string): any => {
      return (ctx:any) => this.compileService.compile(template, ctx);
  }

  //onLoaded(data: any, source: any): void {
  onLoaded = (name: any, data: any, source: any): void => {
    console.log("GeoDashComponentMapMap: ", data, source);
    //
    this.dashboard = data["dashboard"];
    this.state = data["state"];

    // Initialize Map
    var listeners = <any>{
      "map": <any>{
        singleclick: this.onMapSingleClick,
        postrender: this.onMapPostRender
      },
    };
    geodash.var.map = geodash.init.map_ol3(<any>{
      "id": "map",
      "dashboard": this.dashboard,
      "state": this.state,
      "listeners": listeners
    });

    // Initialize JSTS
    if(typeof jsts != "undefined")
    {
      if(! geodash.util.isDefined(geodash.var.jsts_parser))
      {
        geodash.var.jsts_parser = new jsts.io.OL3Parser();
      }
    }

    // Baselayers
    if(extract("baselayers", this.dashboard, []).length > 0)
    {
      var baselayers = geodash.layers.init_baselayers_ol3(geodash.var.map, this.dashboard.baselayers);
      geodash.util.extend(geodash.var.baselayers, baselayers);
      // Load Default/Initial Base Layer
      var baseLayerID = this.dashboard.view.baselayer || this.dashboard.baselayers[0].id;
      geodash.var.map.addLayer(geodash.var.baselayers[baseLayerID]);
      //geodash.api.intend("viewChanged", {'baselayer': baseLayerID}, $scope);
      //geodash.api.intend("layerLoaded", {'type':'baselayer', 'layer': baseLayerID}, $scope);
    }

    // Feature Layers
    if(Array.isArray(extract("featurelayers", this.dashboard)))
    {
      for(var i = 0; i < this.dashboard.featurelayers.length; i++)
      {
        var fl = this.dashboard.featurelayers[i];
        //geodash.layers.init_featurelayer(fl.id, fl, $scope, live, dashboard, state);
        geodash.layers.init_featurelayer({
          "id": fl.id,
          "fl": fl,
          "dashboard":this.dashboard,
          "state": this.state
        });
      }
    }

    this.bus.emit("primary", "geodash:maploaded", <any>{}, this.name);

  }

  onMapSingleClick = (e: any): void => {
    var m = geodash.var.map;
    var v = m.getView();
    var c = ol.proj.toLonLat(e.coordinate, v.getProjection());
    var data = <any>{
      "location": <any>{
        "lat": c[1],
        "lon": c[0]
      },
      "pixel": <any>{
        "x": e.pixel[0],
        "y": e.pixel[1]
      }
    };
    this.bus.emit("intents", "clickedOnMap", data, this.name);
  }

  onMapPostRender = (e: any): void => {
    var popover = $("#popup").data("bs.popover");
    if(geodash.util.isDefined(popover))
    {
      var tether = popover._tether;
      if(geodash.util.isDefined(tether))
      {
        tether.position()
      }
    }
  }

  onRefresh = (name: any, data: any, source: any): void => {
    this.state = data["state"];

    var visibleBaseLayer = this.state.view.baselayer;
    var currentLayers = geodash.mapping_library == "ol3" ? geodash.var.map.getLayers().getArray() : undefined;
    geodash.util.objectToArray(geodash.var.baselayers).forEach((x:any) => {
      let layer = x.value;
      var visible = x.name == visibleBaseLayer;
      if(geodash.mapping_library == "ol3")
      {
        if(currentLayers.indexOf(layer) != -1 && !visible)
        {
          geodash.var.map.removeLayer(layer);
        }
        else if(currentLayers.indexOf(layer) == -1 && visible)
        {
          geodash.var.map.addLayer(layer);
        }
      }
      else
      {
        if(geodash.var.map.getLayers().getArray().indexOf(layer) != -1 && !visible)
        {
          geodash.var.map.removeLayer(layer);
        }
        else if(geodash.var.map.getLayers().getArray().indexOf(layer) == -1 && visible)
        {
          geodash.var.map.addLayer(layer);
        }
      }
    });

    var visibleFeatureLayers = this.state.view.featurelayers;
    geodash.util.objectToArray(geodash.var.featurelayers).forEach((x:any) => {
      var layer = x.value
      var visible = visibleFeatureLayers.indexOf(x.name) != -1;
      if(geodash.mapping_library == "ol3")
      {
        if(currentLayers.indexOf(layer) != -1 && !visible)
        {
          geodash.var.map.removeLayer(layer);
        }
        else if(currentLayers.indexOf(layer) == -1 && visible)
        {
          geodash.var.map.addLayer(layer);
        }
      }
      else
      {
        if(geodash.var.map.getLayers().getArray().indexOf(layer) != -1 && !visible)
        {
          geodash.var.map.removeLayer(layer);
        }
        else if(geodash.var.map.getLayers().getArray().indexOf(layer) == -1 && visible)
        {
          geodash.var.map.addLayer(layer);
        }
      }
    });

    // Update Render Order
    var renderLayers = geodash.util.objectToArray(geodash.var.featurelayers).filter((x:any) => visibleFeatureLayers.indexOf(x["name"]) != -1);
    //var renderLayers = $.grep(layersAsArray(geodash.var.featurelayers), function(layer){ return $.inArray(layer["id"], visibleFeatureLayers) != -1;});
    //var renderLayersSorted = sortLayers(renderLayers.map((layer:any) => layer["layer"]}), true);
    //var baseLayersAsArray = geodash.util.objectToArray(geodash.var.baselayers).map((x:any) => {'id':x.name, 'layer': x.value});
    //var baseLayersAsArray = $.map(geodash.var.baselayers, function(layer, id){return {'id':id,'layer':layer};});
    /*var baseLayers = $.map(
      $.grep(layersAsArray(geodash.var.baselayers), function(layer){return layer["id"] == visibleBaseLayer;}),
      function(layer, i){return layer["layer"];});*/

    // Force Refresh
    if(geodash.mapping_library == "ol3")
    {
      setTimeout(function(){

        var m = geodash.var.map;
        m.renderer_.dispose();
        m.renderer_ = new ol.renderer.canvas.Map(m.viewport_, m);
        //m.updateSize();
        m.renderSync();

      }, 0);
    }
    else if(geodash.mapping_library == "leaflet")
    {
      for(var i = 0; i < renderLayers.length; i++)
      {
          renderLayers[i].bringToFront();
      }

      setTimeout(function(){ geodash.var.map._onResize(); }, 0);
    }
  }

  onChangeView = (name: any, data: any, source: any): void => {
    console.log("Changing view...");
    if(geodash.util.isDefined(extract("layer", data)))
    {
      geodash.navigate.layer(data)
    }
    else if(geodash.util.isDefined(extract("extent", data)))
    {
      var newExtent = undefined;
      var extent = extract("extent", data);
      if(geodash.util.isString(extent))
      {
        if(extent == "initial")
        {
          if(! geodash.var.map.getView().getAnimating())
          {
            //geodash.navigate.start($scope);
          }
        }
        else if(extent == "previous" || extent == "prev")
        {
          if(! geodash.var.map.getView().getAnimating())
          {
            //geodash.navigate.back($scope);
          }
        }
        else if(extent == "next" || extent == "forward")
        {
          if(! geodash.var.map.getView().getAnimating())
          {
            //geodash.navigate.forward($scope);
          }
        }
      }
      else
      {
        geodash.navigate.location({
          "animate": extract("animate", data),
          "duration": extract("duration", data),
          "extent": geodash.normalize.extent(extent, {
            "sourceProjection": "EPSG:4326",
            "targetProjection": geodash.var.map.getView().getProjection().getCode()
          })
        });
      }
    }
    else
    {
      geodash.navigate.location({
        "animate": extract("animate", data),
        "duration": extract("duration", data),
        "lat": extract("lat", data),
        "lon": extract("lon", data),
        "zoom": extract("zoom", data)
      });
    }
  }

  onOpenPopup = (name: any, data: any, source: any): void => {
    console.log("Opening popup...", data);
    if(
      geodash.util.isDefined(data["featureLayer"]) &&
      geodash.util.isDefined(data["feature"]) &&
      geodash.util.isDefined(data["location"])
    )
    {
      geodash.popup.openPopup(
        this.interpolate,
        data["featureLayer"],
        data["feature"],
        data["location"],
        geodash.var.map,
        this.state
      );
    }
  }
}

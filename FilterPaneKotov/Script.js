var highlightMode = false;
var standardMenu;
var posx;var posy;var initx=false;var inity=false;
var showFilterPane = false;
var paneWidth = 750;
var shifted = false;
var shiftedUp = false;
var currentTab = "";

var levels = {};
levels.panel01 = "pan01";
// four levels of folding.
// page- main panel - panel - element


Qva.AddDocumentExtension('FilterPaneKotov', function(){
    Qva.LoadCSS('/QvAjaxZfc/QvsViewClient.aspx?public=only&type=Document&name=Extensions/FilterPaneKotov/docextension.css');
        $('document').ready(function() {
	    //var divMain = $('#MainContainer');
		var kk=$('[class$="MOVEDOWN01"]');
		kk.click(function() {
			shiftDown();
		});
		kk=$('[class$="HOVERABOUT"]');
		kk.click(function() {
			build();
		});
	
	});    
});


function shiftDown () {
	var hShift;
	var h;
	var qvDoc = Qv.GetCurrentDocument();								// get Qv - to main class
	if (shiftedUp) {													// for _panel_ define direction
		$('#filterPane').animate({height:'150px'});
		hShift= -300;													// estimate height of folding (panel attr)
		qvDoc.SetVariable("vShiftSign","1");							// set Qv Var - predefined name
	}
	else {
		$('#filterPane').animate({height:'450px'});
		hShift= 300;
		qvDoc.SetVariable("vShiftSign","0");
	}
	//'Document\TB01'
	/*$('#Document\TB01').each(function (){
		h = parseInt($(this).css('height').replace('px',''))+hShift;
		$(this).animate({height:h+'px'});
    })*/
	
	/*
	var kk=$('#Document\TB01');
	var divFilterPane = $('#filterPane');
	$(divFilterPane).append(kk);
	*/
	
	
	var kk=$('[class$="TB01"]');										// for all under current panel 
	h = parseInt(kk.css('top').replace('px',''))+hShift;				// css('top').replace('px','')+hShift
	kk.css('top',h+'px');
	kk=$('[class$="MOVEDOWN01"]');
	h = parseInt(kk.css('top').replace('px',''))+hShift;
	kk.css('top',h+'px');
	
	shiftedUp=!shiftedUp;												// invert panel folding sign
}

function build()
{
  //$("#pseudoLoading").show();
  alert('build');
    var qvDoc = Qv.GetCurrentDocument();
 //   qvDoc.SetOnUpdateComplete(shiftLeft);    
 /*
	qvDoc.GetAllObjects(function(objects) {
		    alert('objects:'+objects.length);
            for (var i = 0; i < objects.length; i++) 
            {
                var obj = objects[i];
                var id = obj.id;
                var caption = obj.caption;
                var type = obj.type;
                var el = obj.element;
				alert(' id='+id+' capt='+caption+' type='+type+' html='+el);
            }
        });
*/
	
   // list all jQuery objects
   $('.QvFrame').each(function(){
		alert($(this).attr("id")+' class='+$(this).attr("class")+' displ='+ $(this).css('display'));	
	});		
	
	
};

//Override the addclass function so we can move the required objects on sheet change
(function(){
    var originalAddClassMethod = jQuery.fn.addClass;
	
	jQuery.getScript("definitions.js", function(){  null;	});
	
	
    jQuery.fn.addClass = function(){
        // Execute the original method.
        var result = originalAddClassMethod.apply( this, arguments );
		
		//alert('elements processing '+ $(this).attr("class"));
		
        // call your function
        // this gets called everytime you use the addClass method
        if($(this).hasClass("selectedtab"))
	{
	    var newTab = $(this).attr("id");
		
	    if(newTab != currentTab )
	    {
		    // alert('originalAddClassMethod call build');
	        shifted = false;
	       // build();
	    }
	    currentTab = newTab;
	}

        // return the original result
        return result;
    }
	
})(jQuery);



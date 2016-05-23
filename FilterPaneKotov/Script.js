var highlightMode = false;
var standardMenu;
var posx;var posy;var initx=false;var inity=false;
var showFilterPane = false;
var paneWidth = 750;
var shifted = false;
var shiftedUp = false;
var currentTab = "";
var qvObjectsList;
var docQv;

/**
 * document extension for up/down shifting regions 
 * @author Sergii Kotov <Sergii_Kotov@epam.com>
 * https://github.com/Sergjalo/qvDocumentExtension/
 * 
 * Date: 2016-05
 *
 * For objects, that should shift, Object ID in QV should be like 
 * page-PAGENUM p-MAINPANELNUM pan-PANELNUM butAction-ELEMENTNUM
 * for instance - "page-0 p-0 pan-1 butAction-2" or "page-2 p-0 pan-1 text-3"
 * 
 * in QlikView there shoud be variable for every panel - vShiftSign_page_MainPanel_Panel (vShiftSign0_0_3 - for panel 3)
 * when it 1 - all elements that are not in header should be invisible and sign on folding button should be "down arrow"
 * so for all panel objects except headers and placed on header - define conditional view on vShiftSignn_n_n = 0
 * and on every action button place text like =if(vShiftSign0_0_0=1,chr(9660),chr(9650))
 *
 * Number of panels is unlimited.
 *
 * if element should make fold/unfold action - simply name it as "butAction" (like in first example).
 * (it name shouldn't be strictly "butAction", it should only contain "butAction"
 * 
 * now mainPanels functionality is not ready (folding nested groups of panels). 
 * but for future using name static header of panel like headerF or headerUF. 
 * А meen that initial state is fold, UF - unfold.
 * 
 * Examples:
 * "page-2 p-0 pan-1 headerUFbutAction-3" - that object id describe element that is header of panel #1
 * that'll be show in full size (unfolded) and by cliking on that header it will fold/unfold
 *
 * "page-2 p-0 pan-3 headerF-37"
 * "page-0 p-0 pan-3 butAction-7" - two elements. first - header, another - button to act with panel #3
 *
 * todo - grab state of folding of panel from header element name. if acn be headerF/headerUF
 * 
 * headers - first top element in panel. Or named as header
 * main panel height - sum of h simple panels - only headers if folded - header h+panel h if unfolded
 * folding of main panels is under development
 */
 
 /**
 * @constructs Element
 * @param id {string} element's id from html
 * @param num {number} number of element from Qv
 * @param type {string} type of element from name, defined in Qv like combo-15 or but-22
 * @param panMainId {number} number of logical grouping elements on the most common level
 * @param panId {number} number of logical grouping elements on the lowest level
 * @param top {number} element's top
 * @param height {number} element's height
 * @param click {function} onClick event function
 */
function Element (id,num,type,panMainId,panId, top, height, click) {
	this.id = id;
	this.num = num;
	this.type = type;
	this.panMainId = panMainId;
	this.panId = panId;
	this.top = top;
	this.height = height;
	this.click=click;
}

/**
* @constructs list of all Qv elements on page that should shift up/down
* @param pageNum {number} number of Qv Tab (page)
*/
function ElementsList (pageNum) {
	this.qvDoc = Qv.GetCurrentDocument();	// get Qv - to main class
	this.elem = [];
	this.panels = [];     // {height,id,mainId,fold,header};
	this.mainPanels = []; // {height,id,fold};
	this.pageNum=pageNum;
	this.initFolding=false; // unfold
	
	var elNum;
	var elType;
	var panNumIter=0;
	var self = this;
	// fill elem
	$('[class^="QvFrame Document_page-'+pageNum+'"]').each( function (){		
		var s= $(this).attr("class");
		
		var reNums = /-\d+/g ;
		var reType = /(\w+)-\d+$/ ;
		var myArray=[];
		var i=0;
		var panelMainNum;
		var panelNum;
		while ((myArray = reNums.exec(s)) != null) {
			switch(i) {
			case 1: //0 - page num, leave it. start from main panel
				panelMainNum=myArray[0].substr(1);
				break;
			case 2:
				panelNum=myArray[0].substr(1);
				break;
			case 3:
				elNum=myArray[0].substr(1);
				break;
			}
			i++;
		}
		// 4th level of folding is element level
		if (i==4) {
			myArray = reType.exec(s);
			elType=myArray[1];
			// for elements that should react to fold/unfold panel define function 
			var fFold = null;
			if (elType.indexOf('butAction')>-1) {
				fFold= function (){
					self.foldPanel(panelNum);
				}
			}
			self.elem.push(new Element($(this).attr("id"),elNum,elType,panelMainNum,panelNum, $(this).css('top'), $(this).css('height'),fFold)); //(id,num,type,panMainId,panId)
			// and tie it to element
			if (!(fFold==undefined)) {
				$(this).click(fFold);
			}	
		}	
		return true;
	});
	if (self.elem.length >0) {
		// fill panels and mainPanels
		findPanelHeights();
		findMainPanelHeights();
	}
	
	//----------------------------------------------------------------------------------------------------------------
	/**
	 * @description shift panels under current. It do nothing with current panel,
	 * cause it assumed that it visibility is switched by qV variable
	 * panId {number} id of panel to be folded/unfolded
	 */
	this.foldPanel = function (panId){
		var pan;
		var pId;
		for (var pn=0; pn<self.panels.length; pn++) {
			if (self.panels[pn].id==panId) {
				pan= self.panels[pn];
				pId= pn;
				break;
			}
		}
		if (pan==undefined) {
			return false;
		}
		
		// get Qv - to main class
		// set Qv Var - predefined name vShiftSign_page_MainPanel_Panel
		var hShift;
		if (pan.fold) {
			hShift= pan.height;											
			self.qvDoc.SetVariable("vShiftSign"+self.pageNum+'_'+pan.mainId+'_'+pan.id,"0");
		}
		else {
			hShift= -pan.height;
			self.qvDoc.SetVariable("vShiftSign"+self.pageNum+'_'+pan.mainId+'_'+pan.id,"1");
		}
		
		var listShiftedObj=self.usePanel(pan.id, true, false);
		for (var k=0; k<listShiftedObj.length; k++) {
			var g=$('#'+listShiftedObj[k].id);
			var h=parseInt(g.css('top').replace('px',''))+hShift;
			//var h=parseInt(g.position().top)+hShift;
			$('#'+listShiftedObj[k].id).css('top',h+'px');
		}
		self.panels[pId].fold=!pan.fold;
	}
	
	/**
	 * @description fill panels array with max heights of it elements
	 * @private
	 */
	function findPanelHeights (){
		// find uniq panels id
		self.elem.forEach(function(item) {
			if (self.panels.indexOf(item.panId)==-1) {
				self.panels.push(item.panId);
			}	
		});
		// fill max height
		self.panels=self.panels.map(function(item) {
			//alert("item="+item);
			var k=self.elem.reduce(function(max, current) {
				if (+current.panId == +item) {
					if (+max.height.replace('px','')<+current.height.replace('px','')) {
						return current;
					}
				}
				return max; 
			}, {height:'0px'});
			// header height
			// define header by name of element "header" 
			// 		for futher development - we'll pick up element that on the top of panel
			// that is bad choice, cause main panels should strictly named like p, panels like pan and headers like head
			k.hh=$('[class^="qvFrame Document_page-'+self.pageNum+' p-'+k.panMainId+' pan-'+k.panId+' head"]').css('height');
			return {
					height: +k.height.replace('px',''),
					id: k.panId,
					mainId: k.panMainId,
					fold: self.initFolding,
					header: (k.hh)?+k.hh.replace('px',''):0
				};
		});
		
		/* that is the same but without map and reduce
		for (var i=0; i<self.panels.length; i++) {
			max = {height:'0px'};
			for (var l=0; l<self.elem.length; l++) {
				if (+self.elem[l].panId == +self.panels[i]) {
					if (+max.height.replace('px','')<+self.elem[l].height.replace('px','')) {
						max=self.elem[l];
					}
				}
				
			}
			alert("max.id="+max.panId+ " h="+max.height);

			// header height
			// define header by name of element "header" 
			// 	for futher development - we'll pick up element that on the top of panel
			// that is bad choice, cause main panels should strictly named like p, panels like pan and headers like head
			max.hh=$('[class^="qvFrame Document_page-'+self.pageNum+' p-'+max.panMainId+' pan-'+max.panId+' head"]').css('height');
			alert("s="+max.panMainId+max.panId);
			self.panels[i]= 
				{
					height: +max.height.replace('px',''),
					id: max.panId,
					mainId: max.panMainId,
					fold: self.initFolding,
					header: (max.hh)?+max.hh.replace('px',''):0
				};
		}
		*/
		return true;
	}

	// for all panels on main sum their heights
	function findMainPanelHeights (){
		// find uniq mainPanels id
		self.elem.forEach(function(item) {
			if (self.mainPanels.indexOf(item.panMainId)==-1) {
				self.mainPanels.push(item.panMainId);
			}	
		});
		// fill max height
		self.mainPanels=self.mainPanels.map(function(item) {
			var k=self.panels.reduce(function(sum, current) {
				if (+current.mainId == +item) {
					sum.height+=current.height;
				}
				return sum; 
			},{height: 0});
			return {
					id:	+item,
					height: k.height,
					fold: true
				};
		});
		return true;
	}

	/**
	 * @description compare elements regarding to flags 
	 * @private
	 * @param a {object} element object from list of all objects
	 * @param b {number} number of panel or Main panel on wich or under wich elements should be finded
	 * @param isBelow {boolean} flag to define if elements on other panels that under b required
	 * @param isMain {boolean} flag to define level of panel
	 * @returns {boolean} is element a fit requirements 
	 */
	function compareElements (a,b,isBelow, isMain) {
		a=(isMain) ? a.panMainId : a.panId;
		if (isBelow) {
			return a>b
		}
		else {
			return a==b
		}
	}
	
	/**
	 * @description return array of elements that on panel (or main panel isMain=true) or below that panel (isBelow=true)
	 * @param panelNum {number} number of panel or Main panel on wich or under wich elements should be finded
	 * @param isBelow {boolean} flag to define if elements on other panels that under b required
	 * @param isMain {boolean} flag to define level of panel
	 * @returns {array} array of founded elements
	 */
	this.usePanel = function (panelNum, isBelow, isMain) {
		var arElem=[];
		for (var k=0; k<this.elem.length; k++) {
		//for (k in this.elem) {
			if (compareElements(this.elem[k],panelNum,isBelow, isMain)) {
				arElem.push(this.elem[k]); //console.log(elem[k].id+ " "+ elem[k].type+ " "+ elem[k].num);
			}
		}
		return arElem;
	}
} // ElementsList

//*****************************************************************************************************************************
Qva.AddDocumentExtension('FilterPaneKotov', function(){
	Qva.LoadCSS('/QvAjaxZfc/QvsViewClient.aspx?public=only&type=Document&name=Extensions/FilterPaneKotov/docextension.css');
	$('document').ready(function() {
		
		var kk=$('[class$="HOVERABOUT"]');
		kk.click(function() {
			build();
		});
		docQv = Qv.GetCurrentDocument();
		docQv.SetOnUpdateComplete(function() {
			if (qvObjectsList!=undefined) {
				//alert("w="+qvObjectsList.elem.length);
				null;
			}
			else {
				qvObjectsList=new ElementsList(0);
				// document should be opened with all visible panel elements,
				// but for usability we should collapse them all
				for (var i=0; i<qvObjectsList.panels.length; i++) {
					qvObjectsList.foldPanel(qvObjectsList.panels[i].id);
				}	
			}
			});
	});
});


function build()
{
	
   // list all jQuery objects
   $('.QvFrame').each(function(){
		alert($(this).attr("id")+' class='+$(this).attr("class")+'. '+$(this).css("display"));	
	});		
	
    //var qvDoc = Qv.GetCurrentDocument();
	// qvDoc.SetOnUpdateComplete(shiftLeft);    
	/*
	qvDoc.GetAllObjects(function(objects) {
		    alert('objects:'+objects.length);
            for (var i = 0; i < objects.length; i++) 
            { alert(' id='+objects[i].id+' capt='+objects[i].caption+' type='+objects[i].type); }
        });
	*/
	/*	
	$('[class^="QvFrame Document_TX_NOTVISIBLE"]').each( function (){		
		var prevVis=$(this).css("display");
		alert(prevVis);
		$(this).css("display", 'block');
		alert($(this).attr("class")+'. '+$(this).css("display")+$(this).css("height"));	
		//$(this).css("display", prevVis);
	});
	*/
};

//Override the addclass function so we can move the required objects on sheet change
(function(){
    var originalAddClassMethod = jQuery.fn.addClass;
	//jQuery.getScript("definitions.js", function(){  null;	});
    jQuery.fn.addClass = function(){
        // Execute the original method.
        var result = originalAddClassMethod.apply( this, arguments );
        // call your function
        // this gets called everytime you use the addClass method
        if($(this).hasClass("selectedtab"))
		{
			var newTab = $(this).attr("id");
			// set all vars that control visibility to 0 (show), cause initial state of all elements should be visible
			docQv.GetAllVariables(function(vars) {
				for (var i = 0; i < vars.length; i++) {
					if (vars[i].name.indexOf("vShiftSign")>-1) {docQv.SetVariable(vars[i].name,"0");}
				}
			});
			// jump to another page
			if(newTab == currentTab )
			{
				// doing so we force to fill qvObjectsList during next execution of docQv.SetOnUpdateComplete 
				qvObjectsList=undefined;
			}
			currentTab = newTab;
		}
        // return the original result
        return result;
    }
	//alert("end?")
})(jQuery);



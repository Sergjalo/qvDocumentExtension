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
 * p-MAINPANELNUM pan-PANELNUM butAction-ELEMENTNUM
 * for instance - "p-0 pan-1 butAction-2" or "p-0 pan-1 text-3"
 * 
 * in QlikView there shoud be variable for every panel - vShiftSign_MainPanel_Panel (vShiftSign_0_3 - for panel 3)
 * when it 1 - all elements that are not in header should be invisible and sign on folding button should be "down arrow"
 * so for all panel objects except headers and placed on header - define conditional view on vShiftSign_n_n = 0
 * and on every action button place text like =if(vShiftSign_0_0=1,chr(9660),chr(9650))
 * For folding main panels there should be variable vShiftSignMain_n 
 * There are some rules for conditional show of panel/main panel elements:
 *	- for elements that lay on main panel but not on simple panels 
 *		vShiftSignMain_0=0
 *	- for elements that lay on main panel but on header of simple panels 
 *		vShiftSignMain_0=0 (same as previous)
 *	- for elements that lay on main panel on simple panels 
 *		vShiftSign_0_1=0 and vShiftSignMain_0=0
 * For switching main panel there should be object with name butMainAction - it'll connected to main panel shift action
 * 
 * Because for tracking objects they should be visible, but some object visability switching by tricky conditions
 * before reload page we set all that conditions to true, and then turn them to usual state. That is done by adding
 * to every switching condition external condition like vShiftSignN or ( usual_condition )
 * 
 * Number of panels is unlimited.
 * if only one panel should be shown at one time apllication should have variable vShiftOnlyOne=1.
 *
 * if element should make fold/unfold action - simply name it as "butAction" (like in first example).
 * (it name shouldn't be strictly "butAction", it should only contain "butAction"
 * 
 * 
 * headers - name (last part of objectID before last number) starting from  "header"
 * main panel height - sum of h simple panels - only headers if folded - header h+panel h if unfolded
 * when panel collapsing its mainPanel change size.
 * 
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
*/
function ElementsList () {
	this.qvDoc = Qv.GetCurrentDocument();	// get Qv - to main class
	this.elem = [];
	this.panels = [];     // {height,id,mainId,fold,header,partOfMain};
	this.mainPanels = []; // {height,id,fold};
	this.initFolding=false; // unfold
	this.onePanelShow=0;	// show only one unfold panel
	
	var elNum;
	var elType;
	var panNumIter=0;
	var self = this;
	// fill elem
	$('[class^="QvFrame Document_"]').each( function (){		
		var s= $(this).attr("class");
		
		var reNums = /-\d+/g ;
		var reType = /(\w+)-\d+$/ ;
		var myArray=[];
		var i=0;
		var panelMainNum;
		var panelNum;
		while ((myArray = reNums.exec(s)) != null) {
			switch(i) {
			case 0: 
				panelMainNum=myArray[0].substr(1);
				break;
			case 1:
				panelNum=myArray[0].substr(1);
				break;
			case 2:
				elNum=myArray[0].substr(1);
				break;
			}
			i++;
		}
		// 3th level of folding is element level
		if (i==3) {
			myArray = reType.exec(s);
			elType=myArray[1];
			// for elements that should react to fold/unfold panel define function 
			var fFold = null;
			if (elType.indexOf('butAction')>-1) {
				fFold= function (){
					self.foldPanel(panelNum);
				}
				// and tie it to element
				$(this).click(fFold);
			}
			if (elType.indexOf('butMainAction')>-1) {
				fFold= function (){
					self.foldMainPanel(panelMainNum);
				}
				// and tie it to element
				$(this).click(fFold);
			}
			self.elem.push(new Element($(this).attr("id"),elNum,elType,panelMainNum,panelNum, $(this).css('top'), $(this).css('height'),fFold)); //(id,num,type,panMainId,panId)
		}	
		return true;
	});
	if (self.elem.length >0) {
		// sorting by top position
		self.elem.sort(function(a, b) {
			if (a.panId == b.panId) {
				return a.top - b.top;
			} else {
				return a.panId - b.panId;
			}
		});
		// fill panels and mainPanels
		findPanelHeights();
		findMainPanelHeights();
	}
	
	//----------------------------------------------------------------------------------------------------------------
	/**
	 * @description shift panels under current. It do nothing with current panel,
	 * cause it assumed that it visibility is switched by qV variable
	 * panId {number} id of panel to be folded/unfolded
	 * collapseOther {boolean} default == undefined for collapsing other expanded panels if in onePanelShow mode
	 */
	this.foldPanel = function (panId, collapseOther){
		var pan;
		var pId;
		var unfolded=[];
		for (var pn=0; pn<self.panels.length; pn++) {
			if (self.panels[pn].id==panId) {
				pan= self.panels[pn];
				pId= pn;
			}
			else { // if there any other unfolded panels 
				if ((!self.panels[pn].fold) && (!self.panels[pn].partOfMain) &&(collapseOther==undefined)) {
					unfolded.push(self.panels[pn].id); // collect their id
				}
			}
		}
		if (pan==undefined) {
			return false;
		}
		// if there are other unfolded panel we should fold them
		if (collapseOther==undefined) {
			if (self.onePanelShow==1) {
				for (var i=0; i<unfolded.length; i++) {
					self.foldPanel(unfolded[i],1);
				}
			}
		}
		
		// get Qv - to main class
		// set Qv Var - predefined name vShiftSign_page_MainPanel_Panel
		var hShift;
		if (pan.fold) {
			hShift= pan.height;											
			self.qvDoc.SetVariable("vShiftSign_"+pan.mainId+'_'+pan.id,"0");
		}
		else {
			hShift= -pan.height;
			self.qvDoc.SetVariable("vShiftSign_"+pan.mainId+'_'+pan.id,"1");
		}
		
		var listShiftedObj=self.usePanel(pan.id, true, false);
		for (var k=0; k<listShiftedObj.length; k++) {
			var g=$('#'+listShiftedObj[k].id);
			var h=parseInt(g.css('top').replace('px',''))+hShift;
			$('#'+listShiftedObj[k].id).css('top',h+'px');
			//alert("hShift="+hShift+" h="+h+" - "+listShiftedObj[k].id+ " top="+$('#'+listShiftedObj[k].id).css('top'));
		}
		for (var k=0; k<self.mainPanels.length; k++) {
			if (self.mainPanels[k].id==pan.mainId) {
				self.mainPanels[k].height+=hShift;
			}
		}
		self.panels[pId].fold=!pan.fold;
	}

	/**
	 * @description shift panels under current. It do nothing with current panel,
	 * cause it assumed that it visibility is switched by qV variable
	 * panMainId {number} id of panel to be folded/unfolded
	 */
	this.foldMainPanel = function (panMainId){
		//alert(self.mainPanels.length);
		var pan;
		var pId;
		for (var pn=0; pn<self.mainPanels.length; pn++) {
			if (self.mainPanels[pn].id==panMainId) {
				pan= self.mainPanels[pn];
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
			self.qvDoc.SetVariable("vShiftSignMain_"+pan.id,"0");
		}
		else {
			hShift= -pan.height;
			self.qvDoc.SetVariable("vShiftSignMain_"+pan.id,"1");
		}
		var listShiftedObj=self.usePanel(pan.id, true, true);
		//alert(hShift);
		// from top main panel to top +height last panel
		//hShift=0;
		for (var k=0; k<listShiftedObj.length; k++) {
			var g=$('#'+listShiftedObj[k].id);
			var h=parseInt(g.css('top').replace('px',''))+hShift;
			$('#'+listShiftedObj[k].id).css('top',h+'px');
			//alert("hShift="+hShift+" h="+h+" - "+listShiftedObj[k].id+ " top="+$('#'+listShiftedObj[k].id).css('top'));
		}
		//alert(k);
		self.mainPanels[pId].fold=!pan.fold;
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
			k.hh=$('[class^="QvFrame Document_p-'+k.panMainId+' pan-'+k.panId+' head"]').css('height');
			
			// for every elem of panel check if there type butMainAction. if so - that is part of mainPanel
			var poM=false;
			for (var i=0; i<self.elem.length; i++) {
				if ((k.panMainId==self.elem[i].panMainId)&&
					(k.panId==self.elem[i].panId)&&
					(self.elem[i].type.indexOf('butMainAction')>=0)) {
					poM=true;
				}
			}
			
			return {
					height: +k.height.replace('px',''),
					id: k.panId,
					mainId: k.panMainId,
					fold: self.initFolding,
					header: (k.hh)?+k.hh.replace('px',''):0,
					partOfMain: poM
				};
		});
		return true;
	}

	// for all panels on main sum their heights
	function findMainPanelHeights (){
		// find uniq mainPanels id
		//self.mainPanels=[];
		self.elem.forEach(function(item) {
			if (self.mainPanels.indexOf(item.panMainId)==-1) {
				self.mainPanels.push(item.panMainId);
			}	
		});
		// fill max height
		self.mainPanels=self.mainPanels.map(function(item) {
			var k=self.panels.reduce(function(sum, current) {
				if (+current.mainId == +item) {
					//alert("head"+current.header + " h="+current.height);
					sum.height+=current.header+current.height;
					//alert("sum="+sum.height);
				}
				return sum; 
			},{height: 0});
			//////////////////////////////////////
			/*
			var fold =item.fold;
			if (fold==undefined) {
				var fold=self.initFolding;
			}
			*/
			//alert (" m "+k.height);
			return {
					id:	+item,
					height: k.height,
					fold: self.initFolding//fold
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
		docQv.GetAllVariables(function(vars) {
			for (var i = 0; i < vars.length; i++) {
				if (vars[i].name.indexOf("vShiftSign")>-1) {docQv.SetVariable(vars[i].name,"0");}
				// // all conditional switching set to visible for grabbing them to qvObjectsList
				if (vars[i].name.indexOf("vShowSwitch")>-1) {docQv.SetVariable(vars[i].name,"1");}
			}
		});
		docQv.SetOnUpdateComplete(function() {
			//alert("on update");
			if (qvObjectsList!=undefined) {
				//alert("w="+qvObjectsList.elem.length);
				null;
			}
			else {
				qvObjectsList=new ElementsList();
				// set all vars that control visibility to 0 (show), cause initial state of all elements should be visible
				// document should be opened with all visible panel elements,
				// but for usability we should collapse them all
				// so as array is sorted by panels and top position - collapse from bottom
				//for (var i=0; i<qvObjectsList.elem.length; i++) {
				let set = new Set();
				for (var i=qvObjectsList.elem.length-1; i>=0; i--) {
					if (qvObjectsList.elem[i].click!=undefined) {
						//alert(qvObjectsList.elem[i].num+" pan="+qvObjectsList.elem[i].panId);

						// for every panel only one click!
						if (!set.has(qvObjectsList.elem[i].panId)) {
							qvObjectsList.elem[i].click();
							set.add(qvObjectsList.elem[i].panId);
						}
					}
				}
				
				docQv.GetAllVariables(function(vars) {
					for (var i = 0; i < vars.length; i++) {
						if (vars[i].name.indexOf("vShiftOnlyOne")>-1) {
							qvObjectsList.onePanelShow=vars[i].value; }
						// all conditional switching to usual state	
						if (vars[i].name.indexOf("vShowSwitch")>-1) {
							docQv.SetVariable(vars[i].name,"0")}
					}
				});
			}
		}); //SetOnUpdateComplete
	});
});


function build()
{
   // list all jQuery objects
   $('.QvFrame').each(function(){
		alert($(this).attr("id")+' class='+$(this).attr("class")+'. '+$(this).css("display"));	
	});		
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
})(jQuery);



let sigmaInst; // sigma graph instance
let seriesMap; // dictionary of series data
let genresMap; // dictionary of genre data
let metadata;  // data metadata
let config;    // configuration info

let yearThreshold;         // minimum year shown
let scoreThreshold = 0;    // minimum score shown
let selectedNodeId = null; // selected node id
let userData = null;       // data retrieved for a user
let isAnimeGraph = true;   // whether graph is for anime of manga

/** Initialize the site */
function init(isAnime) {
    isAnimeGraph = isAnime;
    initSigma();
    jQuery(initPage());
}

/** Initialize sigma helper methods */ 
function initSigma() {
    // Create a method to get neighboring node ids for a given node
    sigma.classes.graph.addMethod('neighborNodeIds', function(nodeId) {
        return Object.keys(this.allNeighborsIndex[nodeId]).map(str => Number(str));
    });

    // Create a method that will remove and readd an edge to make it redraw on the very top
    sigma.classes.graph.addMethod('bringEdgeToTop', function(edge) {
        const idx = this.edgesArray.indexOf(edge);
        this.edgesArray.splice(idx, 1);
        this.edgesArray.push(edge);
    })

    // Custom node with border renderer
    sigma.canvas.nodes.border = function(node, context, settings) {
        const prefix = settings('prefix') || '';
    
        // Draw node
        context.fillStyle = node.color || settings('defaultNodeColor');
        context.beginPath();
        context.arc(node[prefix+'x'], node[prefix+'y'], node[prefix+'size'], 0, Math.PI*2, true);
        context.closePath();
        context.fill();
    
        // Add border
        if (node.borderColor) {
            context.lineWidth = node.borderWidth || 1;
            context.strokeStyle = node.borderColor || node.color || settings('defaultNodeColor');
            context.stroke();
        }
    };
}

/** Fetch graph and configuration data and initialize the page */
async function initPage() {
    // Get stored data
    const type = graphType();
    config = await fetch(`data/${type}_config.json`).then(res => res.json());
    const data = await fetch(`data/${type}_data.json`).then(res => res.json());

    // Create dictionaries for data access
    seriesMap = new Map(data.nodes.map(node => [node['id'], node]));
    genresMap = new Map(data.genres.map(item => [item['id'], item]));
    metadata = data.metadata;

    // Initialise the graph and main panel
    initGraph(data);
    initMainPanel();
}

/** Initialize the main panel */
function initMainPanel() {
    // Init text
    $("#title-img").attr("src", config.headerImage); 
    $("#intro").html(config.intro);
    $("#last-updated").append(metadata.lastUpdated);
    
    // Init score slider
    const scoreSlider = $("#score-slider");
    const scoreLabel = $("#score-val");
    scoreLabel.text(Number(scoreSlider[0].value).toFixed(2));
    scoreSlider[0].oninput = function() {
        scoreThreshold = this.value;
        scoreLabel.text(Number(scoreThreshold).toFixed(2));
        refreshGraph();
    }

    // Init year slider
    let years = Array.from(seriesMap.values()).map(s => s.startYear).filter(Number);
	const yearMin = Math.min.apply(Math, years); 
    const yearMax = Math.max.apply(Math, years); 

    const yearSlider = $("#year-slider");
    const yearLabel = $("#year-val");
    yearSlider.attr("min", yearMin);
    yearSlider.attr("max", yearMax);
    yearSlider.attr("value", yearMin);
    yearLabel.text(yearSlider[0].value);
    yearSlider[0].oninput = function() {
        yearThreshold = this.value;
        yearLabel.text(yearThreshold);
        refreshGraph();
    };

    // Create checkboxes
    const genres = Array.from(genresMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    for (const genre of genres) {
        genre.selected = true;
        const checkboxId = 'genre-checkbox' + genre.id;
        const checkboxContainer = $('#checkbox-container');
        checkboxContainer.append(
            $(document.createElement('input')).prop({
                id: checkboxId,
                type: 'checkbox',
                checked: true
            })
        );
        checkboxContainer.append(
            $(document.createElement('label')).prop({
                for: checkboxId,
            }).html(genre.name)
        );
        checkboxContainer.append(document.createElement('br'));

        const checkbox = $('#'+checkboxId);
        checkbox[0].onchange = function() {
            const gen = genresMap.get(genre.id);
            gen.selected = this.checked;
            refreshGraph();
        };
    } 
}

/** Initalize the sigma network graph */
function initGraph(data) {
    let g = {
        nodes: [],
        edges: []
    };

    // Add nodes to graph
    for (const node of data.nodes) {
        g.nodes.push({
            id: node.id,
            label: node.name, 
            x: node.xPos,
            y: node.yPos,
            size: node.size,
            color: node.color,
            borderColor: null,
            borderWidth: config.graph.borderWidth
        })
    }

    // Add edges to graph
    for (const edge of data.edges) {
        g.edges.push({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            size: edge.size,
            weight: edge.weight,
            color: config.graph.edgeColor
        })   
    }

    // Setup settings
    const settings = {
        defaultNodeType: 'border',
        hideEdgesOnMove: true,
        batchEdgesDrawing: false, 
        immutable: true,
        hoverFontStyle: "bold",
        maxNodeSize: config.sigma.maxNodeSize,
        minNodeSize: config.sigma.minNodeSize,
        maxEdgeSize: config.sigma.maxEdgeSize,
        minEdgeSize: config.sigma.minEdgeSize,
        defaultLabelSize: config.sigma.defaultLabelSize,
        labelThreshold: config.sigma.labelThreshold,
        defaultLabelColor: config.sigma.defaultLabelColor,
        defaultLabelHoverColor: config.sigma.defaultLabelHoverColor,
        defaultHoverLabelBGColor: config.sigma.defaultHoverLabelBGColor,
        zoomMax: config.sigma.zoomMax,
        zoomMin: config.sigma.zoomMin
    };

    // Create sigma instance
    sigmaInst = new sigma({
        graph: g,
        renderer: {
            type: 'canvas',
            container: $('#sigma-container')[0],
        },
        settings: settings
    });

    // Bind events
    sigmaInst.bind("clickNode", e => selectNode(e.data.node));
    sigmaInst.bind("overNode", e => hoverNode(e.data.node));
    sigmaInst.bind("outNode", () => refreshGraph());

    // Draw graph
    sigmaInst.refresh();
}

/** Open the side panel */
function openSidePanel() {
    const infoPanel = $("#series-info-panel");
    infoPanel[0].style.width = "260px";
    infoPanel[0].scrollTop = 0;
}

/** Close the side panel and reset data */
function closeSidePanel() {
    // Clear data
    $("#series-img-link").attr("href", null);
    $("#series-img").attr("src", null);
    $("#series-title").empty();
    $("#series-data").empty();
    $("#series-neighbors").empty(); 
    $("#series-info-panel")[0].style.width = "0";

    // Unselect node
    unselectNodes();
    refreshGraph();
}

/** Checks or unchecks all of the genre checkboxes */
function checkAll(checked) {
    for (const genre of genresMap.values()) {
        const checkbox = $('#genre-checkbox'+genre.id);
        genre.selected = checked;
        checkbox[0].checked = checked;
    }
    refreshGraph();
}

/** Selects a node */
async function selectNode(node) {
    centerCameraOnNode(node)
    openSidePanel();
    showSelectedGraph(node);
    await displaySeriesData(node.id)
}

/** Moves the camera to a node */
function centerCameraOnNode(n) {
    const c = sigmaInst.camera;
    sigma.misc.animation.camera(
        c, 
        {
            x: n[c.readPrefix + 'x'], 
            y: n[c.readPrefix + 'y'],
            ratio: (c.ratio > config.graph.selectedNodeZoom) ? 
                   config.graph.selectedNodeZoom : c.ratio 
        }, 
        { duration: config.graph.animationTime }
    );
}

/** Selects a node using the node id */
async function selectNodeById(nodeId) {
    const node = sigmaInst.graph.nodes().find(n => n.id == nodeId);
    await selectNode(node);
}

/** Displays series data in the side panel for the given series */
async function displaySeriesData(nodeId) {
    // Fetch series data from Jikan

    const result = await fetch(`https://api.jikan.moe/v4/${graphType()}/${nodeId}`)
                         .then(res => res.json());
    const seriesData = result.data;

    // Set image path and link
    $("#series-img-link").attr("href", seriesData.url);
    const seriesImage = $("#series-img");
    seriesImage.attr("src", seriesData.images.jpg.image_url);
    seriesImage.attr("onmouseover", `induceNodeHover(${nodeId})`); 
    seriesImage.attr("onmouseout", `induceNodeUnhover(${nodeId})`);  

    // Set series title and link
    const seriesTitle = $("#series-title");
    seriesTitle.text(seriesData.title); 
    seriesTitle.attr("href", seriesData.url);
    seriesTitle.attr("onmouseover", `induceNodeHover(${nodeId})`); 
    seriesTitle.attr("onmouseout", `induceNodeUnhover(${nodeId})`);  

    // Display series data
    const seriesDataText = $("#series-data");
    seriesDataText.empty(); // clear any existing text
    seriesDataText.append('<p><strong>' + emptyIfNull(seriesData.title_english) + '</strong></p>');
    seriesDataText.append('<p><strong>Score:</strong> ' + seriesData.score.toFixed(2) + '</p>');
    seriesDataText.append('<p><strong>Rank:</strong> #' + seriesData.rank.toLocaleString("en-US") + '</p>');
    seriesDataText.append('<p><strong>Popularity:</strong> #' + seriesData.popularity.toLocaleString("en-US") + '</p>');
    seriesDataText.append('<p><strong>Members:</strong> ' + seriesData.members.toLocaleString("en-US") + '</p>');
    seriesDataText.append('<p><strong>Favorites:</strong> ' + seriesData.favorites.toLocaleString("en-US") + '</p>');
    seriesDataText.append('<p><strong>Type:</strong> ' + seriesData.type + '</p>');
    if (isAnimeGraph) {
        seriesDataText.append('<p><strong>Episodes:</strong> ' + emptyIfNull(seriesData.episodes) + '</p>');
        seriesDataText.append('<p><strong>Season:</strong> ' + emptyIfNull(capitalize(seriesData.season)) + 
                              ' ' + emptyIfNull(seriesData.year) + '</p>');
        seriesDataText.append('<p><strong>Aired:</strong> ' + emptyIfNull(seriesData.aired.string) + '</p>')
        seriesDataText.append('<p><strong>Studios:</strong> ' + seriesData.studios.map(s => s.name).join(', ') + '</p>'); 
    } else {
        seriesDataText.append('<p><strong>Volumes:</strong> ' + emptyIfNull(seriesData.volumes) + '</p>');
        seriesDataText.append('<p><strong>Chapters:</strong> ' + emptyIfNull(seriesData.chapters) + '</p>');
        seriesDataText.append('<p><strong>Published:</strong> ' + emptyIfNull(seriesData.published.string) + '</p>');
    }
    seriesDataText.append('<p><strong>Genres:</strong> ' + seriesData.genres.concat(
                          seriesData.explicit_genres, seriesData.themes, 
                          seriesData.demographics).map(g => g.name).join(', ') + '</p>');
    seriesDataText.append(seriesData.synopsis);

    // Display neighbor links
    const seriesNeighborText = $("#series-neighbors");
    seriesNeighborText.empty(); // clear any existing text
    const neighborIds = sigmaInst.graph.neighborNodeIds(nodeId);
    const edges = sigmaInst.graph.edges();
    // Get list of neighboring edges
    let neighborEdges = neighborIds.map(neighborId => edges.find(e => 
                            (e.source == nodeId && e.target == neighborId) || 
                            (e.source == neighborId && e.target == nodeId)));
    // Sort by descending weight
    neighborEdges = neighborEdges.sort((a, b) => b.weight - a.weight);
    // Create links to select nodes
    for (const neighborEdge of neighborEdges) {
        const neighborId = (neighborEdge.source == nodeId) ? neighborEdge.target : neighborEdge.source;
        const s = seriesMap.get(neighborId);
        seriesNeighborText.append(`<a href="javascript:void(0)" onclick="selectNodeById(${neighborId})"` + 
                                  `onmouseover="induceNodeHover(${neighborId})" onmouseout="induceNodeUnhover(${neighborId})">` + 
                                  `${s.name} (${neighborEdge.weight}) </a><br/>`);
    }
}

/** Resets all node and edge colors and redraws the graph */
function refreshGraph() {
    for (const node of sigmaInst.graph.nodes()) {
        setNominalNodeColor(node)
    }
    for (const e of sigmaInst.graph.edges()) {
        e.color = config.graph.edgeColor;
    }
    sigmaInst.refresh();
}

/** Determines and sets the proper node color and node label for a node */
function setNominalNodeColor(node){
    const series = seriesMap.get(node.id);
    // Highlight node if it is selected
    if (selectedNodeId == node.id) {    
        node.color = config.graph.selectedColor;
        node.label = series.name;
    // Darken and remove node label if filtered out
    } else if (shouldFilter(series)) { 
        node.color = config.graph.filteredColor;
        node.label = ""; 
    // Otherwise reset the node color and label
    } else {                            
        node.color = series.color;
        node.label = series.name;
    }

    // Set border color if there is user data
    if (userData != null) {
        const userDataSeries = userData.find(d => d.node.id == node.id);
        if (userDataSeries !== undefined) {
            const status = userDataSeries.list_status.status;
            switch (status) {
                case 'watching':
                    node.borderColor = "#2db039";
                    break;
                case 'completed':
                    node.borderColor = "#26448f";
                    break;
                case 'on_hold':
                    node.borderColor = "#f9d457";
                    break;
                case 'dropped':
                    node.borderColor = "#a12f31";
                    break;
                case 'plan_to_watch':
                    node.borderColor = "#c3c3c3";
                    break;
            }
            if (selectedNodeId != node.id)
                node.color = config.graph.userNodeColor;
        } else {
            node.borderColor = null;
        }
    } else {
        node.borderColor = null;
    }
}

/** Whether or not a series should be filtered out */
function shouldFilter(series) {
    const isOutsideYearThreshold = series.startYear == null || series.startYear < yearThreshold;
    const isOutsideScoreThreshold = series.score < scoreThreshold;
    const areGenresNotSelected = !series.genres.map(g => genresMap.get(g).selected).includes(true);
    return isOutsideYearThreshold || isOutsideScoreThreshold || areGenresNotSelected;
}

/** When a node is selected, shows only neighboring nodes and edges */
function showSelectedGraph(node) {
    // Unhide all nodes and edges
    unselectNodes(); 
    // Set the selected node id
    selectedNodeId = node.id;
    // Hide all non neighbors
    const neighbors = sigmaInst.graph.neighborNodeIds(node.id);
    for (const n of sigmaInst.graph.nodes()) {
        if (!neighbors.includes(n.id) && n.id != node.id)
            n.hidden = true;
    }
    // Hide everything not in the neighborhood
    for (const e of sigmaInst.graph.edges()) {
        if (e.source != node.id && e.target != node.id && 
            !neighbors.includes(e.source) && !neighbors.includes(e.target))
            e.hidden = true;
    }
    refreshGraph();
}

/** Sets the selected node id to null and unhides all nodes and edges */
function unselectNodes() {
    selectedNodeId = null;
    for (const n of sigmaInst.graph.nodes()) {
        n.hidden = false;
    }
    for (const e of sigmaInst.graph.edges()) {
        e.hidden = false;
    }
}

/** Redraws graph upon node hovering. Makes all non-neighbor nodes and edges black,
 *  and redraws neighboring edges on top */
function hoverNode(node) {
    // Reset node color and label if it was previously filtered out
    const series = seriesMap.get(node.id);
    node.color = series.color;
    node.label = series.name; 
    // Black out all non-neighboring nodes and edges 
    const neighbors = sigmaInst.graph.neighborNodeIds(node.id);
    for (const n of sigmaInst.graph.nodes()) {
        if (!neighbors.includes(n.id) && n.id != node.id) {
            n.borderColor = null;
            n.color = config.graph.hiddenColor;
        }
    }
    for (const e of sigmaInst.graph.edges()) {
        if (e.source != node.id && e.target != node.id)
            e.color = config.graph.hiddenColor;
        else
            sigmaInst.graph.bringEdgeToTop(e);
    }
    sigmaInst.refresh({ skipIndexation: true });
}

/** Applies the hover effect on a node */
function induceNodeHover(nodeId) {
    sigmaInst.renderers[0].dispatchEvent('overNode', {node:sigmaInst.graph.nodes(nodeId)});
}

/** Applies the unhover effect on a node */
function induceNodeUnhover(nodeId) {
    sigmaInst.renderers[0].dispatchEvent('outNode', {node:sigmaInst.graph.nodes(nodeId)});
}

/** Searches for series and displays results in the main panel */
function searchSeries() {
    let input = $("#series-search")[0].value;
    input = input.toLowerCase();
    // Clear results section
    const resultsHeader = $("#results-header");
    resultsHeader.empty();
    const searchResults = $("#search-results");
    searchResults.empty();
    // Search series names with input
    if (input.length > 2) {
        resultsHeader.text("Results: ");
        for (const series of seriesMap.values()) {
            //TODO?: Sort results by likely matches
            if (series.name.toLowerCase().includes(input) || 
                emptyIfNull(series.engName).toLowerCase().includes(input) ||
                emptyIfNull(series.jpName).toLowerCase().includes(input)) {

                searchResults.append(`<a href="javascript:void(0)" onclick="selectNodeById(${series.id})"` +
                                     `onmouseover="induceNodeHover(${series.id})" onmouseout="induceNodeUnhover(${series.id})">` + 
                                     `${series.name} </a><br/>`);
            }
        }
    }
}

/** Clears the search results */
function clearSearch() {
    $("#series-search")[0].value = "";
    $("#results-header").empty();
    $("#search-results").empty();
}

/** Attempts to select a user if entered */
async function enterUser(ele) {
    // Check if user has been entered
    if (ele.keyCode == 13) {
        let input = $("#user-filter")[0].value;
        await selectUser(input);
    }
}

/** Retrieves user data and recolors node (borders?) */
async function selectUser(username) {
    // RIP Jikan user lists, MAL cors policy blocks requests so corsanywhere it is :/
    const proxy_url = 'https://corsanywhere.herokuapp.com/';
    const mal_url = `https://api.myanimelist.net/v2/users/${username}/${graphType()}list`;

    // Get user data
    let newUserData = [];
    let requestResult;
    let offset = 0;
    const limit = 1000;
    do {
        const full_url = `${proxy_url}${mal_url}?` + new URLSearchParams({
            'limit': limit,
            'offset': offset,
            'fields': 'list_status'
        }).toString();

        try {
            requestResult = await fetch(full_url, {
                headers: { "X-MAL-CLIENT-ID": "2ffbb7c299ab5be029fd778e34dcfe37" }, // pls no copy
            }).then(res => res.json());
            newUserData = newUserData.concat(requestResult.data);
            offset = offset + limit;
        } catch (err) {
            console.error(err);
            return;
        }
    } while (requestResult.data.length == limit);

    // Set user data and refresh graph
    userData = newUserData;
    refreshGraph();
}

/** Clears the selected user */
function clearUser() {
    $("#user-filter")[0].value = "";
    userData = null;
    refreshGraph();
}

/** Zooms the view in or out */
function zoom(out) {
    //TODO: is there a library method for this?
    const c = sigmaInst.camera;
    let zoomRatio = out ? (c.ratio * c.settings('zoomingRatio')) :
                          (c.ratio / c.settings('zoomingRatio'));
    if (out)
        zoomRatio = Math.min(zoomRatio, config.sigma.zoomMax);
    else
        zoomRatio = Math.max(zoomRatio, config.sigma.zoomMin);
    if (zoomRatio != c.ratio) {
        sigma.misc.animation.camera(
            c, 
            { ratio : zoomRatio }, 
            { duration: config.graph.animationTime }
        );
    }
}

/** Resets the graph zoom */
function resetZoom() {
    const c = sigmaInst.camera;
    sigma.misc.animation.camera(
        c, 
        {             
            x: 0, 
            y: 0,
            ratio: 1
        }, 
        { duration: config.graph.animationTime }
    );
}

/** Returns string for whether this graph is for anime of manga*/
function graphType() {
    return isAnimeGraph? 'anime' : 'manga';
}

/** Convert any null strings to empty strings */
function emptyIfNull(str) {
    return (str == null) ? "" : str;
}

/** Capitalize the first letter in a string */
function capitalize(str) {
    return str ? (str.charAt(0).toUpperCase() + str.slice(1)) : str;
} 
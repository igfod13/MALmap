# MALmap (V2)
![Malmap image](https://i.imgur.com/9ZQ7sr8.png)

An interactive network graph of anime based on MyAnimeList recommendations. 

Edge weights are equal to the recommendation counts between series. For anime, at least 3 recommendations must be made between two series for the edge to be registered. For manga, this requirement is lowered to 2.

The force-directed layout and detected communities are generated using NetworkX. Data is retrieved using the Jikan API, and is currently processed in the jupyter notebook - will port it to a python script at some point. The graph visualization is built on sigma.js. The only other site dependency is jQuery, so no build is required. 

Feature suggestions welcome!

See the [MyAnimelist forum topic](https://myanimelist.net/forum/?topicid=1388802) for more info.


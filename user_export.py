import re
import time
import numpy as np
import requests
import xml.etree.ElementTree as ET
import json
import collections
import pickle
import os
import sys

class Anime:
    def __init__(self, id_num):
        self.id_num = id_num

# Export user's MAL network graph

# Import anime_list object
__location__ = os.path.realpath(os.path.join(os.getcwd(), os.path.dirname(sys.argv[0])))
anime_list = pickle.load(open(os.path.join(__location__, 'save.p'), 'rb'))

list_file = ''

try:
    input_type = raw_input("Use file?(y/n): ")
except:
    input_type = input("Use file?(y/n): ")
if input_type == 'y':
    use_file = True
else:
    use_file = False
    
if use_file:
    if list_file == '':
        try:
            list_file = raw_input("File name: ")
        except:
            list_file = input("File name: ")
    tree = ET.parse(list_file).getroot()
else:
    # username = "igfod13"
    try:
        username = raw_input("Username: ")
    except:
        username = input("Username: ")
    # Load user's anime list
    url = "https://myanimelist.net/malappinfo.php?status=all&type=anime&u=" + username
    response = requests.get(url)
    # print (response.status_code)
    tree = ET.fromstring(response.content)

# Retrieve user data
user_list = {}
user_score_list ={}
for anime in tree:
    for item in anime:
        if item.tag == 'series_animedb_id':
            temp_id = int(item.text)
        if item.tag == 'my_status':
            if use_file:
                status_name = item.text
                if status_name == 'Watching':
                    temp_status = 1
                elif status_name == 'Completed':
                    temp_status = 2
                elif status_name == 'On Hold':
                    temp_status = 3
                elif status_name == 'Dropped':
                    temp_status = 4
                else:
                    temp_status = 6               
            else:
                temp_status = int(item.text)
        if item.tag == 'my_score':
            temp_score = int(item.text)
    if anime.tag == 'anime':
        user_list[temp_id] = temp_status
        user_score_list[temp_id] = temp_score

# Get user's score distribution
user_data = []    
for i, a in user_score_list.items():
    if a != 0:
        user_data.append(a)
a = np.array(user_data)
if len(a) > 0:
    user_percentile = np.percentile(a, 65)
else:
    user_percentile = 0

# Get total score distribution
data = []
for cur_id, a in anime_list.items():
    data.append(a.score)
a = np.array(data)
p1 = np.percentile(a, 90)
p2 = np.percentile(a, 70)
p3 = np.percentile(a, 40) 

# MAL status IDS: 1 = watching, 2 = completed, 3 = on hold, 4 = dropped, 6 = plan to watch
# Additional IDS: 9 = highly ranked by user, 10-13 = top 0-10/10-30/30-60/60-100% ranked unwatched
for cur_id, a in anime_list.items():
    if cur_id in user_list:
        if user_list[cur_id] == 2 and user_score_list[cur_id] > user_percentile:
                a.user_status = 9
        else:
            a.user_status = user_list[cur_id]
    else:
        if a.score > p1:
            a.user_status = 10
        elif a.score > p2:
            a.user_status = 11
        elif a.score > p3:
            a.user_status = 12
        else:
            a.user_status = 13
            
# Load exported data file from Gephi
with open(os.path.join(__location__, 'data.json')) as data_file:
    sigma_data = json.load(data_file)
    data_file.close()

# Modify attributes
for d in sigma_data['nodes']:
    cur_id = int(d['id'])
    a = anime_list.get(cur_id)
    attr = collections.OrderedDict()
    attr['Score'] = a.score
    attr['Rank'] = '#' + str(a.rank)
    attr['Popularity'] = '#' + str(a.popularity)
    attr['Members'] = '{:,}'.format(a.members)
    attr['Episodes'] = a.episodes
    attr['Season'] = a.season
    genre_str = '';
    for g in a.genre_names:
        if genre_str is not '':
            genre_str = genre_str + ', '
        genre_str = genre_str + g
    attr['Genres'] = genre_str
    cur_url = '<a href="https://myanimelist.net/anime/' + str(cur_id) + '">' + a.name + '</a>'
    attr['MAL Link'] = cur_url
    attr['Synopsis'] = a.synopsis
    attr['Image'] = a.img_url
    d['attributes'] = attr
    # Set node colors
    if a.user_status == 1:
        d['color'] = 'rgb(45,175,55)'
    elif a.user_status == 2:
        d['color'] = 'rgb(40,80,210)'
    elif a.user_status == 3:
        d['color'] = 'rgb(250,210,85)'
    elif a.user_status == 4:
        d['color'] = 'rgb(160,45,50)'
    elif a.user_status == 6:
        d['color'] = 'rgb(255,155,45)'
    elif a.user_status == 9:
        d['color'] = 'rgb(50,190,255)'
    elif a.user_status == 10:
        d['color'] = 'rgb(195,195,195)'
    elif a.user_status == 11:
        d['color'] = 'rgb(155,155,155)'
    elif a.user_status == 12:
        d['color'] = 'rgb(115,115,115)'
    else:
        d['color'] = 'rgb(75,75,75)'
    
for d in sigma_data['edges']:
    d['color'] = 'rgb(75,75,75)'

# Export new data file
with open(os.path.join(__location__, 'data.json'), 'w') as outfile:  
    json.dump(sigma_data, outfile)
import axios from 'axios';

function getTotalTime(seconds) {
    return new Date(seconds*1000).toISOString().substr(11, 8);
}

export async function getQueue() {
    const res = await axios.get('http://35.212.248.153:8080/api/queue');
    const data = res.data;
    data.totalTime = getTotalTime(data.songs.reduce((a, b) => a + parseInt(b.duration), 0)) || '00:00';
    data.lastUpdated = new Date().toString();
    return data;
}
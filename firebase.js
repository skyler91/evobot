var admin = require("firebase-admin");
const { FIREBASE_CONFIG } = require("./util/EvobotUtil");
const songHistoryDb = FIREBASE_CONFIG.song_history_collection;
const songAggregateDb = FIREBASE_CONFIG.song_aggregate_collection;

let db;
if (FIREBASE_CONFIG) {
  admin.initializeApp({
    credential: admin.credential.cert(FIREBASE_CONFIG)
  });
  db = admin.firestore();
} else {
  console.warn("No firebase account specified. Data will not be recorded in the database.")
}

function getSongIdFromUrl(url) {
  const searchParams = new URLSearchParams(new URL(url).search);
  return searchParams.get('v');
}

function createSongHistoryDbJson(song, is_playing = true) {
  const songId = getSongIdFromUrl(song.url);
  const timestamp = Date.now();
  return {
    id: songId,
    qid: song.qid,
    queued_at: timestamp,
    played_at: is_playing ? timestamp : '',
    user: {
      id: song.user.id,
      username: song.user.username
    },
    schema_version: FIREBASE_CONFIG.schema_version || 1
  }
}

async function updateSongAggregate(song, songRefId, is_playing = true) {
  if (!db) return;

  const songId = getSongIdFromUrl(song.url);
  const songAggregateRef = await db.collection(songAggregateDb).doc(songId).get();
  const timestamp = Date.now();
  let s;
  if(songAggregateRef.exists) {
    s = songAggregateRef.data();
    if (is_playing) {
      s.play_count++;
      s.last_played = timestamp;
      s.last_played_by = {
        id: song.user.id,
        username: song.user.username
      };
    } else {
      s.queue_count++;
      s.last_queued = timestamp;
      s.last_queued_by = {
        id: song.user.id,
        username: song.user.username
      };
    }
    if (!s.song_history.includes(songRefId)) {
      s.song_history.push(songRefId);
    }
  } else {
    s = {
      title: song.title,
      duration: song.duration,
      url: song.url,
      play_count: is_playing ? 1 : 0,
      queue_count: 1,
      last_queued: timestamp,
      last_played: is_playing ? timestamp : '',
      last_played_by: is_playing ? {
        id: song.user.id,
        username: song.user.username,
      } : null,
      last_queued_by: {
        id: song.user.id,
        username: song.user.username
      },
      song_history: [songRefId],
      schema_version: FIREBASE_CONFIG.schema_version || 1
    };
  }

  await db.collection(songAggregateDb).doc(songId).set(s);
}

module.exports = {
  async getAllSongHistory() {
    if (!db) return;
    const docRef = await db.collection(songAggregateDb).get();
    return docRef.docs.map(d => d.data());
  },

  async getMostPlayedSongs(count) {
    if (!db) return;
    songs = await db.collection(songAggregateDb).orderBy('play_count', 'desc').limit(count).get();
    data = songs.docs.map(doc => {
      return doc.data();
    });
    //console.debug(data);
    return data;
  },

  async saveSong(song, is_playing = true) {
    if (!db) return;
    //console.debug(song);
    if (!song.qid) {
      console.error("Song does not contain a queue id");
    }

    const songHistoryRef = await db.collection(songHistoryDb).doc(song.qid);
    if (!(await songHistoryRef.get()).exists) {
      await songHistoryRef.set(createSongHistoryDbJson(song, is_playing));
    } else if (is_playing) {
      await songHistoryRef.update({
        played_at: Date.now()
      });
    }

    updateSongAggregate(song, song.qid);
    console.debug(`Saved song with qid: ${song.qid}`);
  }
}
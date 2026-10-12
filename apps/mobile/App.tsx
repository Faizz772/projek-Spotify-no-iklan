import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import type { Track } from "@miusix/contracts";

const tracks: Track[] = [
  {
    id: "45a6ad78-bdd2-4f5e-9737-4858c929f238",
    title: "Velvet Static",
    artist: "Mira Vale",
    album: "Signals After Dark",
    durationSeconds: 246,
    artwork: { background: "#f25f3a", accent: "#111111", label: "VS" },
    streamUrl: "/v1/tracks/45a6ad78-bdd2-4f5e-9737-4858c929f238/stream",
    explicit: false
  },
  {
    id: "dcd5551e-e855-4651-a5bb-c26ee32d764c",
    title: "Soft Collision",
    artist: "June Archive",
    album: "Room Tone",
    durationSeconds: 198,
    artwork: { background: "#bedc64", accent: "#111111", label: "SC" },
    streamUrl: "/v1/tracks/dcd5551e-e855-4651-a5bb-c26ee32d764c/stream",
    explicit: false
  },
  {
    id: "8791268b-dcad-46f4-a73a-5359c2fc4b75",
    title: "Last Train Bloom",
    artist: "Neon Palms",
    album: "Night Transit",
    durationSeconds: 224,
    artwork: { background: "#6657e8", accent: "#f4eddf", label: "LT" },
    streamUrl: "/v1/tracks/8791268b-dcad-46f4-a73a-5359c2fc4b75/stream",
    explicit: false
  }
];

function Artwork({ track, size = 150 }: { track: Track; size?: number }) {
  return (
    <View style={[styles.artwork, { width: size, height: size, backgroundColor: track.artwork.background }]}>
      <View style={[styles.artworkRing, { borderColor: track.artwork.accent }]} />
      <Text style={[styles.artworkLabel, { color: track.artwork.accent }]}>{track.artwork.label}</Text>
    </View>
  );
}

export default function App() {
  const [activeId, setActiveId] = useState(tracks[0]?.id);
  const [playing, setPlaying] = useState(false);
  const activeTrack = useMemo(
    () => tracks.find((track) => track.id === activeId) ?? tracks[0],
    [activeId]
  );

  if (!activeTrack) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>GOOD EVENING</Text>
            <Text style={styles.logo}>MIUSIX</Text>
          </View>
          <Pressable style={styles.profile}><Text style={styles.profileText}>SW</Text></Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.search}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              placeholder="Artists, albums, tracks"
              placeholderTextColor="#77746b"
              style={styles.searchInput}
            />
          </View>

          <View style={styles.mixCard}>
            <Text style={styles.mixKicker}>MIUSIX ORIGINAL · 04</Text>
            <Text style={styles.mixTitle}>Night drive,{`\n`}no destination.</Text>
            <Text style={styles.mixDescription}>Warm synths and soft static for the road home.</Text>
            <Pressable style={styles.mixButton} onPress={() => setPlaying(true)}>
              <Text style={styles.mixButtonText}>▶  PLAY MIX</Text>
            </Pressable>
            <View style={styles.mixSun} />
          </View>

          <View style={styles.sectionHeader}>
            <View><Text style={styles.kicker}>CURATED FOR THIS HOUR</Text><Text style={styles.sectionTitle}>Made for you</Text></View>
            <Text style={styles.seeAll}>SEE ALL →</Text>
          </View>

          <FlatList
            horizontal
            scrollEnabled
            showsHorizontalScrollIndicator={false}
            data={tracks}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.albumList}
            renderItem={({ item }) => (
              <Pressable
                style={styles.album}
                onPress={() => {
                  setActiveId(item.id);
                  setPlaying(true);
                }}
              >
                <Artwork track={item} />
                <Text style={styles.albumTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.albumMeta} numberOfLines={1}>{item.artist}</Text>
              </Pressable>
            )}
          />

          <View style={styles.sectionHeader}>
            <View><Text style={styles.kicker}>YOUR LISTENING HISTORY</Text><Text style={styles.sectionTitle}>Back in rotation</Text></View>
          </View>

          {tracks.map((track, index) => (
            <Pressable
              key={track.id}
              style={styles.trackRow}
              onPress={() => {
                setActiveId(track.id);
                setPlaying(true);
              }}
            >
              <Text style={styles.trackIndex}>0{index + 1}</Text>
              <Artwork track={track} size={48} />
              <View style={styles.trackCopy}>
                <Text style={styles.trackTitle}>{track.title}</Text>
                <Text style={styles.trackArtist}>{track.artist}</Text>
              </View>
              <Text style={styles.trackMore}>•••</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.player}>
          <Artwork track={activeTrack} size={50} />
          <View style={styles.playerCopy}>
            <Text style={styles.playerTitle} numberOfLines={1}>{activeTrack.title}</Text>
            <Text style={styles.playerArtist} numberOfLines={1}>{activeTrack.artist}</Text>
          </View>
          <Pressable onPress={() => setPlaying(!playing)} style={styles.playButton}>
            <Text style={styles.playButtonText}>{playing ? "Ⅱ" : "▶"}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#171714" },
  screen: { flex: 1, backgroundColor: "#f4f1e9" },
  header: {
    paddingHorizontal: 22, paddingTop: 18, paddingBottom: 14,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center"
  },
  kicker: { fontSize: 9, letterSpacing: 1.4, color: "#77746b", fontWeight: "700" },
  logo: { fontSize: 23, fontWeight: "900", letterSpacing: -1.2, color: "#171714" },
  profile: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#bedc64", alignItems: "center", justifyContent: "center" },
  profileText: { fontSize: 10, fontWeight: "700", color: "#171714" },
  scrollContent: { paddingHorizontal: 18, paddingBottom: 112 },
  search: { height: 44, borderRadius: 22, backgroundColor: "#e8e4d9", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, marginBottom: 18 },
  searchIcon: { fontSize: 20, marginRight: 8, color: "#77746b" },
  searchInput: { flex: 1, color: "#171714", fontSize: 13 },
  mixCard: { minHeight: 350, borderRadius: 22, backgroundColor: "#f25f3a", padding: 28, overflow: "hidden" },
  mixKicker: { fontSize: 9, letterSpacing: 1.3, fontWeight: "700", color: "#3a241e" },
  mixTitle: { fontSize: 48, lineHeight: 45, letterSpacing: -3.4, fontWeight: "800", color: "#171714", marginTop: 88, zIndex: 2 },
  mixDescription: { fontSize: 11, lineHeight: 17, color: "#3a241e", marginTop: 14, maxWidth: 230, zIndex: 2 },
  mixButton: { alignSelf: "flex-start", paddingHorizontal: 18, paddingVertical: 12, borderRadius: 22, backgroundColor: "#171714", marginTop: 18, zIndex: 2 },
  mixButtonText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: .5 },
  mixSun: { position: "absolute", width: 220, height: 220, borderRadius: 110, borderWidth: 2, borderColor: "#171714", right: -55, top: 26, opacity: .5 },
  sectionHeader: { marginTop: 34, marginBottom: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  sectionTitle: { fontSize: 23, letterSpacing: -1.2, fontWeight: "800", color: "#171714", marginTop: 4 },
  seeAll: { fontSize: 9, color: "#171714", fontWeight: "700" },
  albumList: { gap: 14 },
  album: { width: 150 },
  artwork: { borderRadius: 14, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  artworkRing: { position: "absolute", width: "60%", height: "60%", borderRadius: 999, borderWidth: 2, opacity: .5 },
  artworkLabel: { fontSize: 42, fontWeight: "900", letterSpacing: -5 },
  albumTitle: { marginTop: 10, fontSize: 12, fontWeight: "700", color: "#171714" },
  albumMeta: { marginTop: 2, fontSize: 10, color: "#77746b" },
  trackRow: { minHeight: 66, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#c9c4b8", flexDirection: "row", alignItems: "center", gap: 12 },
  trackIndex: { width: 20, fontSize: 9, color: "#77746b" },
  trackCopy: { flex: 1 },
  trackTitle: { fontSize: 12, fontWeight: "700", color: "#171714" },
  trackArtist: { fontSize: 10, color: "#77746b", marginTop: 2 },
  trackMore: { color: "#77746b" },
  player: { position: "absolute", left: 10, right: 10, bottom: 10, height: 72, borderRadius: 16, backgroundColor: "#171714", padding: 11, flexDirection: "row", alignItems: "center", gap: 12 },
  playerCopy: { flex: 1 },
  playerTitle: { color: "#fff", fontSize: 12, fontWeight: "700" },
  playerArtist: { color: "#99968e", fontSize: 10, marginTop: 2 },
  playButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  playButtonText: { color: "#171714", fontSize: 14, fontWeight: "800" }
});

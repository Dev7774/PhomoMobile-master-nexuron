import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
} from "react-native";

type Photo = {
  id: string;
  image: { uri: string };
};

type CarouselProps = {
  title: string;
  photos: Photo[];
  onPhotoPress: (photoId: string) => void;
};

export default function Carousel({
  title,
  photos,
  onPhotoPress,
}: CarouselProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      <ScrollView
        horizontal
        contentContainerStyle={styles.images}
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={250 + 15}
        decelerationRate="fast"
      >
        {photos.map((photo) => (
          <TouchableOpacity
            key={photo.id}
            onPress={() => onPhotoPress(photo.id)}
          >
            <Image source={photo.image} style={styles.image} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  title: {
    padding: 15,
    fontWeight: "700",
    fontSize: 20,
  },
  images: {
    gap: 15,
    paddingHorizontal: 20,
  },
  image: {
    width: 250,
    height: 150,
    borderRadius: 15,
  },
});

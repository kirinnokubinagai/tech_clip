---
name: expo-device-apis-native-modules
description: Expo device APIs and native modules for mobile app development. Use when accessing camera, location, sensors, file system, or building custom native modules with Expo Modules API. Covers permission handling, development tools, and native feature integration.
---

# Expo Device APIs & Native Modules

Access device hardware and build custom native functionality in React Native apps.

## When to Apply

- Integrating camera, location, sensors, or file system APIs
- Building custom native modules with Expo Modules API
- Managing permissions for device features
- Setting up development tools and debugging

## Critical Rules

**Permissions First**: Always request permissions before accessing device APIs

```tsx
// WRONG - accessing camera without permissions
const photo = await cameraRef.current.takePictureAsync();

// RIGHT - check/request permissions first
const [permission, requestPermission] = useCameraPermissions();
if (!permission?.granted) {
  await requestPermission();
}
```

**Memory Management**: Always clean up sensor subscriptions

```tsx
// WRONG - memory leak
useEffect(() => {
  const subscription = Accelerometer.addListener(data => setData(data));
}, []);

// RIGHT - cleanup subscription
useEffect(() => {
  const subscription = Accelerometer.addListener(data => setData(data));
  return () => subscription?.remove();
}, []);
```

## Key Patterns

### Camera with Permissions

```tsx
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function CameraScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  if (!permission?.granted) {
    return <Button title="Grant Camera Permission" onPress={requestPermission} />;
  }

  const takePicture = async () => {
    const photo = await cameraRef.current?.takePictureAsync();
    console.log(photo?.uri);
  };

  return (
    <CameraView style={{ flex: 1 }} facing={facing} ref={cameraRef}>
      <Button title="Take Photo" onPress={takePicture} />
    </CameraView>
  );
}
```

### Location Tracking

```tsx
import * as Location from 'expo-location';

export default function LocationTracker() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(location);
    })();
  }, []);

  // Continuous tracking
  const startWatching = async () => {
    await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 10,
      },
      setLocation
    );
  };

  return (
    <View>
      <Text>Lat: {location?.coords.latitude}</Text>
      <Text>Lng: {location?.coords.longitude}</Text>
    </View>
  );
}
```

### Sensor Data with Cleanup

```tsx
import { Accelerometer } from 'expo-sensors';

export default function SensorDemo() {
  const [data, setData] = useState({ x: 0, y: 0, z: 0 });
  const [subscription, setSubscription] = useState(null);

  const subscribe = () => {
    Accelerometer.setUpdateInterval(100);
    setSubscription(Accelerometer.addListener(setData));
  };

  const unsubscribe = () => {
    subscription?.remove();
    setSubscription(null);
  };

  useEffect(() => {
    subscribe();
    return unsubscribe;
  }, []);

  return (
    <View>
      <Text>x: {data.x.toFixed(2)}</Text>
      <Text>y: {data.y.toFixed(2)}</Text>
      <Text>z: {data.z.toFixed(2)}</Text>
    </View>
  );
}
```

### Image Picker

```tsx
import * as ImagePicker from 'expo-image-picker';

export default function ImagePickerDemo() {
  const [image, setImage] = useState<string | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  return (
    <View>
      <Button title="Pick from Library" onPress={pickImage} />
      <Button title="Take Photo" onPress={takePhoto} />
      {image && <Image source={{ uri: image }} style={{ width: 200, height: 200 }} />}
    </View>
  );
}
```

### File System Operations

```tsx
import * as FileSystem from 'expo-file-system';

export default function FileManager() {
  const writeFile = async () => {
    const fileUri = FileSystem.documentDirectory + 'data.txt';
    await FileSystem.writeAsStringAsync(fileUri, 'Hello, World!');
  };

  const readFile = async () => {
    const fileUri = FileSystem.documentDirectory + 'data.txt';
    const content = await FileSystem.readAsStringAsync(fileUri);
    return content;
  };

  const downloadFile = async () => {
    const downloadUri = FileSystem.documentDirectory + 'image.jpg';
    const downloadResumable = FileSystem.createDownloadResumable(
      'https://example.com/image.jpg',
      downloadUri,
      {},
      (progress) => {
        const percent = progress.totalBytesWritten / progress.totalBytesExpectedToWrite;
        console.log(`Progress: ${Math.round(percent * 100)}%`);
      }
    );
    
    const result = await downloadResumable.downloadAsync();
    return result?.uri;
  };

  const deleteFile = async () => {
    const fileUri = FileSystem.documentDirectory + 'data.txt';
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
  };

  return (
    <View>
      <Button title="Write File" onPress={writeFile} />
      <Button title="Read File" onPress={readFile} />
      <Button title="Download File" onPress={downloadFile} />
      <Button title="Delete File" onPress={deleteFile} />
    </View>
  );
}
```

### Custom Native Module

```kotlin
// android/src/main/java/MyModule.kt
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MyModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MyModule")
    
    Function("multiply") { a: Int, b: Int ->
      return@Function a * b
    }
    
    AsyncFunction("fetchDataAsync") { promise ->
      // Async native code here
      promise.resolve("Data fetched!")
    }
  }
}
```

```json
// expo-module.config.json
{
  "ios": {
    "modules": ["MyModule"]
  },
  "android": {
    "modules": ["com.example.MyModule"]
  }
}
```

## Common Mistakes

- **Missing permission requests**: Check and request permissions before API calls
- **Subscription leaks**: Always remove sensor listeners in cleanup
- **Wrong file paths**: Use `FileSystem.documentDirectory` for persistent files, `FileSystem.cacheDirectory` for temporary
- **Synchronous file operations**: Use async methods (`readAsStringAsync`, not sync versions)
- **Camera permission timing**: Check permissions in component mount, not just before photo capture
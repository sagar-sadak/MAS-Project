import { Text, View, StyleSheet, TouchableOpacity, FlatList, Alert, Modal, Image } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { getAuth } from "firebase/auth";
import { analytics, FIRESTORE_DB } from '../../firebaseConfig';
import {collection, addDoc, onSnapshot, deleteDoc, doc, setDoc, getDocs} from "firebase/firestore";
import SearchBook from '../SearchBook';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Timestamp } from "firebase/firestore";

export default function HomeScreen() {
  const auth = getAuth();
  const db = FIRESTORE_DB;
  const user = auth.currentUser;
  const [modalVisible, setModalVisible] = useState(false);
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribesMain = onSnapshot(collection(db, 'books'),  (snapshot) => {
      let allListings = [];

      const listingUnsubscribe = snapshot.docs.map((bookDoc) =>{
        const bookData = bookDoc.data();
        const bookId = bookDoc.id;
        const listingRef = collection(bookDoc.ref, 'listings');

        return onSnapshot(listingRef, (listingSnapshop) => {
          allListings = allListings.filter((listing) => listing.bookId !== bookId);
          // const updatedListings = []
          listingSnapshop.docs.forEach((listingDoc) => {
            
            const listingData = listingDoc.data();
            
            allListings.push({
            id: listingDoc.id, // Unique ID for the listing
            bookId: bookId, // Reference to the book (title)
            title: bookData.title || bookDoc.id, // Fallback to bookId if title is missing
            author: bookData.author,
            coverUrl: bookData.coverUrl,
            listedByEmail: listingData.listedByEmail,
            listedBy: listingData.listedBy,
            timestamp: listingData.timestamp,
            });
          });
          // allListings.push(...updatedListings)
          setBooks([...allListings]);
        });
        // return () => listingUnsubscribe();
      });   
      return () => {listingUnsubscribe.forEach((unsubscribe) => unsubscribe());}  
    });
    return () => unsubscribesMain();
  }, []);

  const startChat = async (book) => {

    console.log("Starting chat with user: ", book.listedBy);

    try {

      let doc_name = "";
      if(user.uid.toString() < book.listedBy){
        doc_name = user.uid.toString()+"_"+book.listedBy;
      } else{
        doc_name = book.listedBy+"_"+user.uid.toString();
      }    

      const UserConversationsRef = doc(db, 'UserConversations', doc_name);
      await setDoc(UserConversationsRef, {
        chat_id: doc_name,
        members: [user.uid.toString(), book.listedBy],
        first_user: user.uid.toString(),
        first_user_email: user.email.toString(),
        second_user: book.listedBy,
        second_user_email: book.listedByEmail},
        {merge:true});
    } 
    catch (error){
      console.error(error);
      Alert.alert("Error", "Failed to Start Chat")
    }

    router.push("/MessageScreen")

  }

  const handleBookPress = (book) => {

    if (book.listedByEmail ===user?.email){
      Alert.alert(
        "Delete this listing?",
        "Are you sure you want to remove this book?",
        [
          {text: "Yes, Delete", onPress: ()=> deleteListing(book.bookId, book.id)},
          {text: "Cancel", style: "cancel"}
        ]
      );
    } else {
    Alert.alert(
      book.title,
      "Choose an option:",
      [
        {text: "Borrow", onPress: () => startChat(book)},
        {text: "Exchange", onPress: () => startChat(book)},
        {text: "Cancel", style: "cancel"}
      ]
    );
  }
  };

  const handleCreateListing = () => {
    setModalVisible(true)

  };

  const addBookToFirestore = async () => {
    if (!selectedBook){
          Alert.alert("Error", "No book selected.");
          return;
        }
    try {      
      const bookRef = doc(db, 'books', selectedBook.title);
      await setDoc(bookRef, {
        author: selectedBook.author,
        coverUrl: selectedBook.coverUrl },
        {merge:true});

      const listingRef = collection(bookRef, 'listings');
      await addDoc(listingRef, {
        listedByEmail: user?.email || 'Unknown',
        listedBy: user?.uid,
        timestamp: Timestamp.now(),
      });
      Alert.alert("Success!", "Book Listed")
      setModalVisible(false);
      setSelectedBook(null);
    } 
    catch (error){
      console.error(error);
      Alert.alert("Error", "Failed to add book")
    }
  }

  const deleteListing = async ( bookTitle, listingId) => {
    
    try {
      
      const listingRef = doc(db, "books", bookTitle, "listings", listingId)
      await deleteDoc(listingRef); 
      Alert.alert("Success!", "Listing deleted.");
    } catch (error) {
      console.error("Error deleting document:", error);
      Alert.alert("Error", "Failed to delete listing.");
    }
  }

   const report = (item) => {
    addDoc(collection(FIRESTORE_DB, 'reports'), { user: item.listedByEmail, bookTitle: item.title ? item.title:"Title not found", bookAuthor: item.author ? item.author: "Author not found" });
    Alert.alert("Post Reported", "We will look into your report and take action accordingly.");
   };
   const verified = () => {
    Alert.alert("Verification Badge", "User has been verified as a GT student");
   };

  
  return (
    <>
    <Stack.Screen
    options={{
      title: "Explore Listings",
      headerStyle: {backgroundColor: "#25292e"},
      headerTintColor: "#fff",
      headerTitleAlign: 'center',
      headerLeft: () => (
        <TouchableOpacity onPress={() => router.push("/profile")} style={{ marginLeft: 25 }}>
          <Ionicons name="person-circle-outline" size={28} color="white" />
        </TouchableOpacity>
      ), 
      headerRight: () => (
        <TouchableOpacity onPress={() => router.push("/MessageScreen")} style={{ marginRight: 25 }}>
          <Ionicons name="chatbubbles-outline" size={28} color="white" />
        </TouchableOpacity>
      ), 

    }}
    />
    
    <View style={styles.container}>
      

      <FlatList
        data={[...books].sort((a, b) => b.timestamp - a.timestamp)}
        keyExtractor={(item) => item.id}  
        numColumns={2}
        columnWrapperStyle = {styles.row}
        renderItem={({ item }) => {
          const isUserBook = item.listedByEmail === user?.email;
          
          return (
          <TouchableOpacity style = {[styles.bookCard, isUserBook && styles.userBookCard]} onPress={() => handleBookPress(item)}>
            <View style={styles.iconContainer}>
              {item.listedByEmail !== user?.email && (<TouchableOpacity style={styles.reportContainer} onPress={() => report(item)}>
                <MaterialIcons name="report" size={20} color="red" />
                <Text style={{color: 'red', fontSize: 12}}>Report post</Text>
              </TouchableOpacity>)}
              
            { item.listedByEmail.slice(-10) != "gatech.edu" &&
                <MaterialIcons style={{alignSelf: 'flex-end'}} onPress={verified} name="verified" size={24} color="black" />
                }
            </View>
            <View>
              {item.coverUrl && <Image source={{uri: item.coverUrl}} style={styles.bookCover} />}
            <View style={styles.bookInfo}>
              <Text style={styles.bookTitle}>{item.title}</Text>
              <Text style ={styles.bookUser}>{item.author}</Text>
              <Text style={styles.bookUser}>{isUserBook ? "Your Listing" : `Listed by: ${item.listedByEmail}`}</Text>
            </View>
          </View>
          </TouchableOpacity>
          
        )}}
      />

      <TouchableOpacity style = {styles.button} onPress={handleCreateListing}>
        <Text style = {styles.buttonText}>Create a Listing</Text>
      </TouchableOpacity>

      <Modal visible = {modalVisible} animationType='slide' transparent>
        <View style = {styles.modalContainer}>
          <View style = {styles.modalContent}>
            <Text style = {styles.modalTitle}>Search for a Book</Text>
            <SearchBook onSelectBook={(book) => setSelectedBook(book)}/>
            {selectedBook && (
              <View style= {styles.bookCard}>
                {selectedBook.coverUrl && <Image source={{ uri: selectedBook.coverUrl }} style={styles.bookCover}/>}
                <Text style={styles.bookTitle}>{selectedBook.title}</Text>
                <Text style={styles.bookUser}>{selectedBook.author}</Text>
                <TouchableOpacity style={styles.modalButton} onPress={addBookToFirestore}>
                <Text style={styles.modalButtonText}>Click to list this book</Text>
                </TouchableOpacity>

              </View>
            )}
            
            <TouchableOpacity style = {styles.modalButton} onPress={()=> setModalVisible(false)}>
            <Text style= {styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>            
          </View>
        </View>
      </Modal>

    </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16
  },
  iconContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  reportContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  button: {
    backgroundColor: '#333',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  heading: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  row: {
    justifyContent: 'space-between',
  },
  bookCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginVertical: 8,
    width: '48%',
    alignItems: 'right',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bookCover: {
    width: 100,
    height: 150,
    resizeMode: 'contain',
    marginBottom: 8,
  },
  bookInfo: {
    alignItems: 'center',
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  bookUser: {
    fontSize: 14,
    color: '#666',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  modalButton: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  modalButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  userBookCard: {
    backgroundColor: '#d4edda',
    borderColor: '#155724',
    borderWidth: 1,
  },
  // searchResultContainer: {
  //   marginTop: 10,
  // },
});
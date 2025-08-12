import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Assuming db is exported from your firebase init file
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';

interface Message {
  id: string;
  text: string;
  userId: string; // Assuming a user ID
  userName: string; // Assuming a user name
  timestamp: any; // Firebase Timestamp
}

export default function CollaborationPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // Assuming you have a way to get the current user's ID and Name
  // For demonstration, using placeholders:
  const currentUserId = 'user123';
  const currentUserName = 'John Doe';

  useEffect(() => {
    const messagesCollection = collection(db, 'project_collaboration');
    const q = query(messagesCollection, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(fetchedMessages);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching messages:", error);
      setLoading(false);
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, []);

  const handleSendMessage = async () => {
    if (newMessage.trim() === '') return;

    try {
      await addDoc(collection(db, 'project_collaboration'), {
        text: newMessage,
        userId: currentUserId,
        userName: currentUserName,
        timestamp: serverTimestamp(),
      });
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // Basic UI for displaying messages and sending new ones
  // This is a minimal implementation and can be greatly enhanced
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Team Collaboration</CardTitle>
        </CardHeader>
        <CardContent className="h-[500px] flex flex-col">
          <ScrollArea className="flex-1 p-4 border rounded-md mb-4">
            {loading ? (
              <p>Loading messages...</p>
            ) : messages.length === 0 ? (
              <p className="text-muted-foreground">No messages yet.</p>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex items-start gap-3 mb-4 ${msg.userId === currentUserId ? 'justify-end' : ''}`}>
                  {msg.userId !== currentUserId && (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={`https://unavatar.io/github/${msg.userName}`} /> {/* Dummy avatar */}
                      <AvatarFallback>{msg.userName.charAt(0)}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className={`flex flex-col ${msg.userId === currentUserId ? 'items-end' : 'items-start'}`}>
                    <span className="text-xs font-semibold">{msg.userName}</span>
                    <div className={`p-2 rounded-lg max-w-xs ${msg.userId === currentUserId ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
                      {msg.text}
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">
                      {msg.timestamp?.toDate ? formatDistanceToNow(msg.timestamp.toDate(), { addSuffix: true }) : 'just now'}
                    </span>
                  </div>
                  {msg.userId === currentUserId && (
                     <Avatar className="h-8 w-8">
                      <AvatarImage src={`https://unavatar.io/github/${msg.userName}`} /> {/* Dummy avatar */}
                      <AvatarFallback>{msg.userName.charAt(0)}</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))
            )}
          </ScrollArea>
          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <Button onClick={handleSendMessage}>Send</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

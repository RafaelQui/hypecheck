import React, { useMemo, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Image, Linking, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import palette from '@/constants/colors';
import { getCheckUsernameAvailabilityQueryKey, getGetProductQueryKey, getGetProfileReviewsQueryKey, getGetWantsQueryKey, getGetProductReviewsQueryKey, getListProductsQueryKey, getUploadUrl, useCheckUsernameAvailability, useCreateReview, useGetProduct, useGetProductReviews, useGetProfileReviews, useGetWants, useListProducts, useRemoveWant, useSaveWant, useUpdateProfile, type ProductSummary } from '@workspace/api-client-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
const colors = palette.light;

type Product = { id: string; name: string; category: string; price: number; rating: number; reviews: number; recommend: number | null; image: any; imageUrl?: string | null; description: string; reviewer: string; caption: string; likes: number; comments: number; storeUrl?: string | null; retailer?: string | null };
type Review = { user: string; rating: number; text: string; date: string; likes: number; comments: number; image?: any; videoUrl?: string | null };

const products: Product[] = [
  { id:'p1', name:'Portable Mini Projector', category:'Tech', price:34.99, rating:4.4, reviews:2183, recommend:89, image:require('@/assets/images/projector.jpg'), description:'A pocket-sized projector that turns any wall into movie night.', reviewer:'MikeTech', caption:'For the price, this is actually really good.', likes:12400, comments:384 },
  { id:'p2', name:'Cloud Skin Barrier Cream', category:'Beauty', price:18.00, rating:4.7, reviews:946, recommend:94, image:require('@/assets/images/skincare.jpg'), description:'A cushiony daily moisturizer for a soft, dewy finish.', reviewer:'glowwithmaya', caption:'My skin looks rested even when I am not.', likes:8200, comments:207 },
  { id:'p3', name:'Everyday Sling Bag', category:'Fashion', price:24.99, rating:4.5, reviews:1542, recommend:91, image:require('@/assets/images/projector.jpg'), description:'The tiny crossbody that fits more than it should.', reviewer:'stylebyalex', caption:'This is the bag I reach for every single day.', likes:6700, comments:145 },
  { id:'p4', name:'Sunset LED Strip Kit', category:'Home', price:16.49, rating:4.2, reviews:731, recommend:84, image:require('@/assets/images/skincare.jpg'), description:'Warm ambient lighting for your desk, shelf, or bedroom.', reviewer:'roomreset', caption:'Instant cozy mode with zero effort.', likes:5100, comments:92 },
  { id:'p5', name:'FlexFit Resistance Set', category:'Fitness', price:21.99, rating:4.6, reviews:682, recommend:90, image:require('@/assets/images/projector.jpg'), description:'Five resistance bands with a carry pouch for workouts anywhere.', reviewer:'move_with_jo', caption:'A genuinely useful little home gym.', likes:4300, comments:88 },
  { id:'p6', name:'Magnetic Car Phone Mount', category:'Car', price:12.99, rating:4.3, reviews:3100, recommend:87, image:require('@/assets/images/skincare.jpg'), description:'A sturdy, low-profile mount that keeps your eyes on the road.', reviewer:'drivewithsam', caption:'Does not wobble. Finally.', likes:3900, comments:73 },
  { id:'p7', name:'Pocket Bluetooth Speaker', category:'Tech', price:27.50, rating:4.6, reviews:1290, recommend:92, image:require('@/assets/images/projector.jpg'), description:'Small speaker, surprisingly full sound.', reviewer:'soundcheck', caption:'The bass on this tiny thing is wild.', likes:7100, comments:182 },
  { id:'p8', name:'Cooling Eye Patches', category:'Beauty', price:9.99, rating:4.1, reviews:508, recommend:82, image:require('@/assets/images/skincare.jpg'), description:'A quick under-eye reset for slow mornings.', reviewer:'skinbyren', caption:'Keep them in the fridge for the full effect.', likes:2600, comments:61 },
  { id:'p9', name:'Cloud Knit Cardigan', category:'Fashion', price:39.00, rating:4.8, reviews:884, recommend:96, image:require('@/assets/images/projector.jpg'), description:'Oversized, soft, and made for airport days.', reviewer:'closetnotes', caption:'Looks expensive. Feels like a blanket.', likes:9300, comments:211 },
  { id:'p10', name:'Kitchen Scale Pro', category:'Kitchen', price:14.95, rating:4.5, reviews:490, recommend:90, image:require('@/assets/images/skincare.jpg'), description:'A slim digital scale for coffee, baking, and meal prep.', reviewer:'bakewithbee', caption:'My sourdough has never been more consistent.', likes:1800, comments:40 },
  ...Array.from({length:10}, (_, i) => ({ id:`p${i+11}`, name:['Desk Cable Organizer','Pet Travel Water Bottle','Grip Master Controller','Under-Eye Brightener','Soft Touch Pillowcase','Collapsible Storage Bin','Protein Shaker','Mini Dash Cam','Glossy Lip Oil','USB-C Travel Hub'][i], category:['Tech','Pets','Gaming','Beauty','Home','Home','Fitness','Car','Beauty','Tech'][i], price:[8.99,13.5,29.99,11,22,17.99,15.99,44,7.5,19.99][i], rating:4.2 + (i%6)/10, reviews:120+i*43, recommend:81+i%16, image:i%2 ? require('@/assets/images/skincare.jpg') : require('@/assets/images/projector.jpg'), description:'A highly rated everyday find with a surprisingly good payoff.', reviewer:['thefinds','petparent','pixelplay','freshface','homebody','tidyspaces','strongerday','roadready','lipstickless','techcarry'][i], caption:'This one earned a permanent spot in my routine.', likes:900+i*120, comments:24+i*8 })) as Product[],
];
function toDisplayProduct(product: ProductSummary, index: number): Product {
  const fallback = products[index % products.length];
  return {
    ...fallback,
    id: product.id,
    name: product.name,
    category: product.category,
    description: product.description ?? fallback.description,
    price: product.price,
    rating: product.rating ?? 0,
    reviews: product.reviewCount ?? 0,
    recommend: product.worthTheHype ?? null,
    image: product.imageUrl ? { uri: product.imageUrl } : fallback.image,
    imageUrl: product.imageUrl,
    retailer: product.retailer,
  };
}
const categories = ['Tech','Beauty','Fashion','Home','Fitness','Car','Gaming','Pets','Kitchen','Under $25'];
const previousPrices: Record<string, number> = { p1: 49.99, p4: 21.99, p7: 35.99, p10: 19.99 };
const reviews: Review[] = [
  { user:'MikeTech', rating:5, text:'For the price, this is actually really good. Setup took under five minutes and the picture is crisp in a dark room.', date:'2 days ago', likes:184, comments:22, image:require('@/assets/images/projector.jpg') },
  { user:'honest_hannah', rating:4, text:'I bought this for movie nights and it exceeded my expectations. The fan is audible, but not a dealbreaker.', date:'1 week ago', likes:92, comments:8 },
  { user:'dealhunter', rating:4, text:'Great little gift for anyone who loves a cozy night in.', date:'3 weeks ago', likes:44, comments:4 },
];

function Rating({ value, size=13 }: { value:number; size?:number }) { return <View style={s.rating}>{[0,1,2,3,4].map(i => <Ionicons key={i} name={i < Math.round(value) ? 'star' : 'star-outline'} size={size} color={colors.accentForeground} />)}<Text style={s.ratingText}>{value.toFixed(1)}</Text></View>; }
function VideoReviewPreview({ videoUrl }: { videoUrl:string }) {
  const openVideo=async()=>{
    try { await Linking.openURL(videoUrl); }
    catch { Alert.alert('Could not open video','This video is unavailable right now.'); }
  };
  return <Pressable accessibilityRole="link" accessibilityLabel="Play video review" onPress={openVideo} style={profileStyles.videoReviewCard}><View style={profileStyles.videoReviewPlay}><Ionicons name="play" size={24} color="#fff"/></View><Text style={profileStyles.videoReviewTitle}>Video review</Text><Text style={profileStyles.videoReviewCopy}>Tap to play</Text></Pressable>;
}
function Header({ title, subtitle, compact, onAvatarPress }: { title:string; subtitle?:string; compact?:boolean; onAvatarPress?:()=>void }) { const insets=useSafeAreaInsets(); const {session}=useAuth(); const {profile}=useProfile(); const username=profile?.username||session?.user.email?.split('@')[0]||'Guest'; const avatarUrl=profile?.avatarUrl?.trim()||null; return <View style={[s.header,{paddingTop:insets.top+(compact?4:10)}]}><View><Text style={s.brand}>HypeCheck</Text><Text style={s.headerTitle}>{title}</Text>{subtitle && <Text style={s.muted}>{subtitle}</Text>}</View><Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={onAvatarPress} style={[s.avatar,{overflow:'hidden'}]}>{avatarUrl?<Image source={{uri:avatarUrl}} style={{width:'100%',height:'100%',resizeMode:'cover'}}/>:<Text style={s.avatarText}>{username[0].toUpperCase()}</Text>}</Pressable></View>; }
function Chip({ label, active, onPress }: {label:string;active?:boolean;onPress?:()=>void}) { return <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]}><Text style={[s.chipText,active&&s.chipTextActive]}>{label}</Text></Pressable>; }
function PasswordInput({ value, onChangeText, placeholder }: {value:string;onChangeText:(value:string)=>void;placeholder:string}) {
  const [visible,setVisible]=useState(false);
  const inputRef=useRef<any>(null);
  const selectionRef=useRef({start:0,end:0});
  const toggleVisibility=()=>{
    const selection=selectionRef.current;
    setVisible(current=>!current);
    requestAnimationFrame(()=>{
      const input=inputRef.current;
      if(!input)return;
      if(typeof input.setNativeProps==='function')input.setNativeProps({selection});
      else if(typeof input.focus==='function'){input.focus();if(typeof input.selectionStart==='number'){input.selectionStart=selection.start;input.selectionEnd=selection.end;}}
    });
  };
  return <View style={passwordStyles.field}><TextInput ref={inputRef} value={value} onChangeText={onChangeText} onSelectionChange={event=>{selectionRef.current=event.nativeEvent.selection;}} placeholder={placeholder} placeholderTextColor={colors.mutedForeground} style={[s.input,passwordStyles.input]} secureTextEntry={!visible}/><Pressable testID="password-visibility-toggle" accessibilityRole="button" accessibilityLabel={visible?'Hide password':'Show password'} hitSlop={8} onPress={toggleVisibility} style={passwordStyles.toggle}><Ionicons name={visible?'eye-off-outline':'eye-outline'} size={22} color={colors.mutedForeground}/></Pressable></View>;
}

function Onboarding({ onDone }: {onDone:()=>void}) {
  const [step,setStep]=useState(0); const [selected,setSelected]=useState<string[]>([]);
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [login,setLogin]=useState(false); const [submitting,setSubmitting]=useState(false);
  const { signIn, signUp } = useAuth();
  const next=async()=> {
    if(step<2){setStep(step+1);return;}
    if(!email.trim()||!password)return Alert.alert('Add your details','Enter your email and a password with at least 6 characters.');
    setSubmitting(true);
    try { await (login?signIn(email.trim(),password):signUp(email.trim(),password)); onDone(); }
    catch(error) { Alert.alert(login?'Could not sign in':'Could not create account',error instanceof Error?error.message:'Please try again.'); }
    finally { setSubmitting(false); }
  };
  return <View style={s.onboarding}><View style={s.onboardMark}><Ionicons name="checkmark" size={40} color={colors.primaryForeground}/></View><Text style={s.onboardBrand}>HypeCheck</Text>{step===0 ? <><Text style={s.onboardTitle}>Discover products{'\n'}worth buying.</Text><Text style={s.onboardCopy}>Check the hype before you buy. Honest reviews from people who actually tried it.</Text></> : step===1 ? <><Text style={s.onboardTitleSmall}>What are you into?</Text><Text style={s.onboardCopy}>Pick a few interests so your feed feels like you.</Text><View style={s.categoryGrid}>{categories.map(c=><Chip key={c} label={c} active={selected.includes(c)} onPress={()=>setSelected(selected.includes(c)?selected.filter(x=>x!==c):[...selected,c])}/>)}</View></> : <><Text style={s.onboardTitleSmall}>{login?'Welcome back.':'Join the good finds.'}</Text><Text style={s.onboardCopy}>{login?'Sign in to access your Wants and reviews.':'Create an account to save Wants and share your honest take.'}</Text><TextInput value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor={colors.mutedForeground} style={s.input} keyboardType="email-address" autoCapitalize="none"/><PasswordInput key={login?'login-password':'signup-password'} value={password} onChangeText={setPassword} placeholder="Password (6+ characters)"/><Pressable onPress={()=>setLogin(value=>!value)}><Text style={s.skip}>{login?'Need an account? Create one':'Already have an account? Sign in'}</Text></Pressable></>}<View style={s.onboardFooter}><View style={s.dots}>{[0,1,2].map(i=><View key={i} style={[s.dot,i===step&&s.dotActive]}/>)}</View><Pressable disabled={submitting} style={s.primaryButton} onPress={next}><Text style={s.primaryText}>{step===2?(submitting?'Working…':login?'Sign in':'Create account'):'Continue'}</Text><Feather name="arrow-right" size={18} color="#fff"/></Pressable><Pressable onPress={onDone}><Text style={s.skip}>Skip for now</Text></Pressable></View></View>;
}

function Discover({ catalog, wants, setWants, onDetail, onProfile }: {catalog:Product[];wants:string[];setWants:(v:string[])=>void;onDetail:(p:Product)=>void;onProfile:()=>void}) {
  const [index,setIndex]=useState(0);
  const [decision,setDecision]=useState<'want'|'pass'|null>(null);
  const [showFilters,setShowFilters]=useState(false);
  const [following,setFollowing]=useState(false);
  const position=useRef(new Animated.ValueXY()).current;
  const busy=useRef(false);
  const didDrag=useRef(false);
  const current=catalog[index % catalog.length];
  const next=catalog[(index+1) % catalog.length];

  const finish=(direction:number)=>{
    if(busy.current)return;
    busy.current=true;
    const isWant=direction>0;
    if(isWant&&!wants.includes(current.id))setWants([...wants,current.id]);
    setDecision(isWant?'want':'pass');
    Haptics.impactAsync(isWant?Haptics.ImpactFeedbackStyle.Medium:Haptics.ImpactFeedbackStyle.Light).catch(()=>undefined);
    Animated.timing(position,{toValue:{x:direction*Dimensions.get('window').width*1.35,y:direction*-24},duration:310,useNativeDriver:true}).start(()=>{
      position.setValue({x:0,y:0});
      setIndex(value=>value+1);
      setDecision(null);
      setFollowing(false);
      busy.current=false;
    });
  };
  const pan=useRef(PanResponder.create({
    onPanResponderGrant:()=>{didDrag.current=false;},
    onMoveShouldSetPanResponder:(_,g)=>!busy.current&&Math.abs(g.dx)>8,
    onPanResponderMove:(_,g)=>{if(!busy.current){didDrag.current=Math.abs(g.dx)>8;position.setValue({x:g.dx,y:g.dy});}},
    onPanResponderRelease:(_,g)=>{if(Math.abs(g.dx)>105)finish(g.dx>0?1:-1);else Animated.spring(position,{toValue:{x:0,y:0},friction:8,tension:70,useNativeDriver:true}).start();setTimeout(()=>{didDrag.current=false;},120);}
  })).current;
  const rotate=position.x.interpolate({inputRange:[-360,0,360],outputRange:['-10deg','0deg','10deg']});
  const wantOpacity=position.x.interpolate({inputRange:[0,100,220],outputRange:[0,0.65,1],extrapolate:'clamp'});
  const passOpacity=position.x.interpolate({inputRange:[-220,-100,0],outputRange:[1,0.65,0],extrapolate:'clamp'});

  return <View style={[s.screen,{paddingBottom:76}]}>
    <Header title="Discover" subtitle="Find your next great buy." compact onAvatarPress={onProfile}/>
    <View style={s.discoverTop}>
      <View style={s.feedPill}><Text style={s.feedPillText}>For you</Text></View>
      <View style={discoverStyles.swipeDirections}><Text style={discoverStyles.directionLabel}>← PASS</Text><Text style={s.swipeHint}>Swipe to decide</Text><Text style={discoverStyles.directionLabel}>WANT ❤️ →</Text></View>
      <Pressable testID="discover-filters" onPress={()=>setShowFilters(true)} hitSlop={10} style={discoverStyles.filterIcon}><Feather name="sliders" size={20} color={colors.foreground}/></Pressable>
    </View>
    <View style={s.cardStage}>
      <View style={[s.productCard,s.stackedCard]}><Image source={next.image} style={s.cardImage}/></View>
      <Animated.View {...pan.panHandlers} style={[s.productCard,s.activeCard,{transform:[{translateX:position.x},{translateY:position.y},{rotate}]}]}>
        {decision&&<View pointerEvents="none" style={s.decisionPulse}><Ionicons name={decision==='want'?'heart':'close'} size={38} color="#fff"/></View>}
        <Animated.View pointerEvents="none" style={[s.decisionBadge,s.wantBadge,{opacity:wantOpacity}]}><Ionicons name="heart" size={18} color="#fff"/><Text style={s.decisionText}>WANT ❤️</Text></Animated.View>
        <Animated.View pointerEvents="none" style={[s.decisionBadge,s.passBadge,{opacity:passOpacity}]}><Ionicons name="close" size={18} color="#fff"/><Text style={s.decisionText}>PASS</Text></Animated.View>
        <Pressable onPress={()=>{if(!didDrag.current)onDetail(current);}} style={s.cardImageWrap}>
          <Image source={current.image} style={s.cardImage}/><View style={s.videoScrim}/><View style={s.videoBadge}><Ionicons name="play" size={12} color="#fff"/><Text style={s.videoText}>VIDEO REVIEW</Text></View><View style={s.videoPlay}><Ionicons name="play" size={20} color="#fff"/></View>
          <View style={s.actionRail}><Pressable style={s.railButton}><Ionicons name="heart-outline" size={22} color="#fff"/><Text style={s.railCount}>{(current.likes/1000).toFixed(1)}k</Text></Pressable><Pressable style={s.railButton}><Ionicons name="chatbubble-outline" size={21} color="#fff"/><Text style={s.railCount}>{current.comments}</Text></Pressable><Pressable style={s.railButton}><Ionicons name="share-social-outline" size={21} color="#fff"/><Text style={s.railCount}>Share</Text></Pressable></View>
          <View style={s.cardOverlay}><Text style={s.categoryLabel}>{current.category.toUpperCase()}</Text><Text style={s.cardTitle}>{current.name}</Text><View style={discoverStyles.productMeta}><Text style={s.cardPrice}>${current.price.toFixed(2)}</Text><View style={discoverStyles.compactRating}><Ionicons name="star" size={14} color={colors.accentForeground}/><Text style={discoverStyles.ratingValue}>{current.rating.toFixed(1)}</Text><Text style={s.reviewCount}>({current.reviews.toLocaleString()})</Text></View></View><View style={discoverStyles.hypeMetric}><Text style={discoverStyles.hypeEmoji}>🔥</Text><Text style={discoverStyles.hypeNumber}>{current.recommend}%</Text><Text style={discoverStyles.hypeLabel}>Worth the Hype</Text></View></View>
        </Pressable>
        <View style={s.reviewQuote}><View style={s.reviewerRow}><Pressable onPress={()=>Alert.alert('Reviewer profile','Public reviewer profiles are not available yet.')} style={s.miniAvatar}><Text style={s.avatarText}>{current.reviewer[0].toUpperCase()}</Text></Pressable><Pressable onPress={()=>Alert.alert('Reviewer profile','Public reviewer profiles are not available yet.')}><Text style={s.reviewerName}>@{current.reviewer}</Text></Pressable><Pressable onPress={()=>setFollowing(value=>!value)} style={discoverStyles.followButton}><Text style={discoverStyles.followText}>{following?'Following':'Follow'}</Text></Pressable></View><Text style={s.quote}>"{current.caption}"</Text></View>
      </Animated.View>
    </View>
    <View style={s.swipeActions}><Pressable testID="pass-product" disabled={busy.current} onPress={()=>finish(-1)} style={[s.roundAction,s.passAction]}><Ionicons name="close" size={30} color="#D05258"/></Pressable><Pressable testID="want-product" disabled={busy.current} onPress={()=>finish(1)} style={[s.roundAction,s.wantAction]}><Ionicons name="heart" size={30} color="#fff"/></Pressable></View>
    <Text style={s.bottomNote}><Feather name="info" size={13} color={colors.mutedForeground}/> Right swipes go straight to your Wants</Text>
    <Modal visible={showFilters} transparent animationType="fade" onRequestClose={()=>setShowFilters(false)}><View style={discoverStyles.modalBackdrop}><View style={discoverStyles.filterModal}><View style={discoverStyles.modalHeader}><Text style={discoverStyles.modalTitle}>Discover filters</Text><Pressable onPress={()=>setShowFilters(false)}><Feather name="x" size={20} color={colors.foreground}/></Pressable></View><Text style={discoverStyles.filterLabel}>Categories</Text><Text style={discoverStyles.filterValue}>All categories</Text><Text style={discoverStyles.filterLabel}>Price Range</Text><Text style={discoverStyles.filterValue}>Any price</Text><Text style={discoverStyles.filterLabel}>Minimum Rating</Text><Text style={discoverStyles.filterValue}>Any rating</Text><Text style={discoverStyles.mockedNote}>Filter controls are ready for the future filter system.</Text><Pressable onPress={()=>setShowFilters(false)} style={s.primaryButton}><Text style={s.primaryText}>Done</Text></Pressable></View></View></Modal>
  </View>;
}

function Detail({ product: fallbackProduct, onBack, onWant, wanted }: {product:Product;onBack:()=>void;onWant:()=>void;wanted:boolean}) {
  const [tab,setTab]=useState<'Reviews'|'Photos'|'Videos'>('Reviews');
  const productQuery=useGetProduct(fallbackProduct.id,{query:{queryKey:getGetProductQueryKey(fallbackProduct.id),retry:false}});
  const remote=productQuery.data;
  const product:Product=remote?{...fallbackProduct,id:remote.id,name:remote.name,category:remote.category||fallbackProduct.category,price:remote.price,description:remote.description||'',retailer:remote.retailer,imageUrl:remote.imageUrl,image:remote.imageUrl?{uri:remote.imageUrl}:fallbackProduct.image,storeUrl:remote.storeUrl,rating:remote.rating??0,reviews:remote.reviewCount,recommend:remote.worthTheHype??null}:fallbackProduct;
  const reviewQuery=useGetProductReviews(product.id,undefined,{query:{queryKey:getGetProductReviewsQueryKey(product.id),retry:false}});
  const liveReviews:Review[]=reviewQuery.data?.items.map(review=>({user:review.authorUsername||'hypecheck-user',rating:review.rating,text:review.reviewText,date:new Date(review.createdAt).toLocaleDateString(),likes:0,comments:0,image:review.photoUrl?{uri:review.photoUrl}:undefined,videoUrl:review.videoUrl}))??reviews;
  const shownReviews=tab==='Photos'?liveReviews.filter(review=>Boolean(review.image)):tab==='Videos'?liveReviews.filter(review=>Boolean(review.videoUrl)):liveReviews;
  return <ScrollView style={s.page} contentContainerStyle={{paddingBottom:40}}>
    <View style={s.detailHero}><Image source={product.image} style={s.detailImage}/><Pressable onPress={onBack} style={s.backButton}><Feather name="arrow-left" size={21} color="#fff"/></Pressable><Pressable style={s.shareButton}><Feather name="share-2" size={19} color="#fff"/></Pressable></View>
    <View style={s.detailBody}>
      <Text style={s.categoryLabel}>{product.category.toUpperCase()}</Text><Text style={s.detailTitle}>{product.name}</Text><Text style={s.detailDescription}>{product.description}</Text>
      <View style={s.detailStats}><View><Text style={s.detailPrice}>${product.price.toFixed(2)}</Text><Rating value={product.rating}/></View><View style={s.statDivider}/><View><Text style={s.statBig}>{product.recommend===null?'—':`${product.recommend}%`}</Text><Text style={s.statLabel}>Worth the hype</Text></View></View>
      <View style={s.detailButtons}><Pressable onPress={onWant} style={[s.primaryButton,s.flexButton]}><Ionicons name={wanted?'heart':'heart-outline'} size={19} color="#fff"/><Text style={s.primaryText}>{wanted?'In your Wants':'Want it'}</Text></Pressable><Pressable onPress={()=>product.storeUrl?Alert.alert('Store link',product.storeUrl):Alert.alert('No store link','This product does not have a store link yet.')} style={s.outlineButton}><Text style={s.outlineText}>View Product</Text><Feather name="external-link" size={16} color={colors.primary}/></Pressable></View>
      <View style={s.sectionHeader}><Text style={s.sectionTitle}>Community reviews</Text><Text style={s.reviewCount}>{product.reviews?`${product.reviews.toLocaleString()} total`:'Not rated yet'}</Text></View>
      <View style={s.tabs}>{(['Reviews','Photos','Videos'] as const).map(tabName=><Pressable key={tabName} onPress={()=>setTab(tabName)} style={[s.detailTab,tab===tabName&&s.detailTabActive]}><Text style={[s.detailTabText,tab===tabName&&s.detailTabTextActive]}>{tabName}</Text></Pressable>)}</View>
      {shownReviews.length?shownReviews.map((review,index)=><View key={`${review.user}-${review.date}-${index}`} style={s.reviewItem}>{review.image?<Image source={review.image} style={s.reviewThumb}/>:null}{review.videoUrl?<VideoReviewPreview videoUrl={review.videoUrl}/>:null}<View style={s.reviewHead}><View style={s.miniAvatar}><Text style={s.avatarText}>{review.user[0].toUpperCase()}</Text></View><View style={{flex:1}}><Text style={s.reviewerName}>@{review.user}</Text><Rating value={review.rating} size={12}/></View><Text style={s.date}>{review.date}</Text></View><Text style={s.reviewText}>{review.text||'Video review'}</Text><View style={s.reviewFooter}><Text style={s.helpful}><Feather name="thumbs-up" size={14} color={colors.mutedForeground}/> Helpful {review.likes}</Text><Text style={s.helpful}><Feather name="message-circle" size={14} color={colors.mutedForeground}/> {review.comments}</Text></View></View>):<View style={s.emptyTab}><Ionicons name={tab==='Photos'?'images-outline':tab==='Videos'?'videocam-outline':'chatbubble-ellipses-outline'} size={28} color={colors.primary}/><Text style={s.emptyTitle}>No {tab.toLowerCase()} yet</Text><Text style={s.muted}>Be the first to add one.</Text></View>}
    </View>
  </ScrollView>;
}

function SearchScreen({catalog,onDetail}:{catalog:Product[];onDetail:(p:Product)=>void}) { const [query,setQuery]=useState(''); const [category,setCategory]=useState('All'); const shown=useMemo(()=>catalog.filter(p=>(category==='All'||p.category===category)&&(p.name.toLowerCase().includes(query.toLowerCase()))),[catalog,category,query]); return <ScrollView style={s.page} contentContainerStyle={s.scrollPad}><Header title="Search" subtitle="Find products people are talking about."/><View style={s.searchBox}><Feather name="search" size={18} color={colors.mutedForeground}/><TextInput value={query} onChangeText={setQuery} placeholder="Search products" placeholderTextColor={colors.mutedForeground} style={s.searchInput}/></View><Text style={s.sectionTitle}>Explore categories</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.horizontalChips}>{['All',...categories].map(c=><Chip key={c} label={c} active={category===c} onPress={()=>setCategory(c)}/>)}</ScrollView><View style={s.sectionHeader}><Text style={s.sectionTitle}>{query||category!=='All'?'Results':'Trending now'}</Text><Text style={s.reviewCount}>{shown.length} finds</Text></View>{shown.slice(0,8).map(p=><Pressable key={p.id} onPress={()=>onDetail(p)} style={s.resultRow}><Image source={p.image} style={s.resultImage}/><View style={s.resultInfo}><Text style={s.resultCategory}>{p.category}</Text><Text style={s.resultName}>{p.name}</Text><Rating value={p.rating} size={12}/><Text style={s.resultPrice}>${p.price.toFixed(2)}</Text></View><Feather name="chevron-right" size={18} color={colors.mutedForeground}/></Pressable>)}</ScrollView>; }

function WantsScreen({catalog,wants,onDetail,onRemove,onDiscover,isLoading,error}:{catalog:Product[];wants:string[];onDetail:(p:Product)=>void;onRemove:(id:string)=>void;onDiscover:()=>void;isLoading:boolean;error:boolean}) {
  const [category,setCategory]=useState('All');
  const [sort,setSort]=useState('Recently Added');
  const [showSortMenu,setShowSortMenu]=useState(false);
  const [pendingRemoval,setPendingRemoval]=useState<string|null>(null);
  const availableCategories=categories.filter(c=>catalog.some(p=>wants.includes(p.id)&&p.category===c));
  const saved=useMemo(()=>catalog.filter(p=>wants.includes(p.id)&&(category==='All'||p.category===category)).sort((a,b)=>sort==='Price: Low to High'?a.price-b.price:sort==='Price: High to Low'?b.price-a.price:sort==='Highest Rated'?b.rating-a.rating:sort==='Highest HypeScore'?(b.recommend??-1)-(a.recommend??-1):wants.indexOf(a.id)-wants.indexOf(b.id)),[catalog,wants,category,sort]);
  const sortOptions=['Recently Added','Price: Low to High','Price: High to Low','Highest Rated','Highest HypeScore'];
  return <ScrollView style={s.page} contentContainerStyle={s.scrollPad}>
    <Header title="Your Wants ❤️" subtitle={`${wants.length} ${wants.length===1?'product':'products'} you want`}/>
    {error&&<View style={s.syncNotice}><Feather name="wifi-off" size={15} color={colors.primary}/><Text style={s.syncText}>Saved locally — Supabase will sync when available.</Text></View>}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.horizontalChips} contentContainerStyle={s.filterRow}><Chip label="All" active={category==='All'} onPress={()=>setCategory('All')}/>{availableCategories.map(c=><Chip key={c} label={c} active={category===c} onPress={()=>setCategory(c)}/>)}</ScrollView>
    <View style={s.wantsToolbar}><Text style={s.savedLabel}>{saved.length} saved {saved.length===1?'find':'finds'}</Text><Pressable onPress={()=>setShowSortMenu(value=>!value)} style={s.sortButton}><Feather name="sliders" size={14} color={colors.foreground}/><Text style={s.sortText}>{sort}</Text><Feather name={showSortMenu?'chevron-up':'chevron-down'} size={14} color={colors.mutedForeground}/></Pressable></View>
    {showSortMenu&&<View style={s.sortMenu}>{sortOptions.map(option=><Pressable key={option} onPress={()=>{setSort(option);setShowSortMenu(false);}} style={[s.sortOption,sort===option&&s.sortOptionActive]}><Text style={[s.sortOptionText,sort===option&&s.sortOptionTextActive]}>{option}</Text>{sort===option&&<Feather name="check" size={15} color={colors.primary}/>}</Pressable>)}</View>}
    {pendingRemoval&&<View style={s.syncNotice}><Text style={s.syncText}>Remove this product from your Wants?</Text><View style={s.quoteActions}><Pressable onPress={()=>setPendingRemoval(null)} style={s.sortButton}><Text style={s.sortText}>Keep</Text></Pressable><Pressable onPress={()=>{onRemove(pendingRemoval);setPendingRemoval(null);}} style={s.feedPill}><Text style={s.feedPillText}>Remove</Text></Pressable></View></View>}
    {isLoading?<View style={s.emptyTab}><Text style={s.muted}>Loading your Wants…</Text></View>:saved.length===0?<View style={s.emptyTab}><View style={s.emptyHeart}><Ionicons name="heart-outline" size={34} color={colors.primary}/></View><Text style={s.emptyTitle}>Nothing here yet ❤️</Text><Text style={[s.muted,s.emptyCopy]}>Swipe right on products you want and they'll appear here.</Text><Pressable onPress={onDiscover} style={[s.primaryButton,s.discoverButton]}><Text style={s.primaryText}>Discover Products</Text><Feather name="arrow-right" size={17} color="#fff"/></Pressable></View>:<View style={s.wantGrid}>{saved.map(p=>{const previous=previousPrices[p.id];const discount=previous?Math.round((1-p.price/previous)*100):0;return <Pressable key={p.id} onPress={()=>onDetail(p)} style={s.wantCard}><Image source={p.image} style={s.wantImage}/><View style={s.wantCategory}><Text style={s.wantCategoryText}>{p.category}</Text></View><Pressable onPress={(event)=>{event.stopPropagation();setPendingRemoval(p.id);}} hitSlop={10} style={s.remove}><Ionicons name="heart" size={16} color={colors.primary}/></Pressable><View style={s.wantContent}><Text numberOfLines={2} style={s.wantName}>{p.name}</Text>{previous?<View style={s.priceDrop}><Text style={s.wasPrice}>Was ${previous.toFixed(2)}</Text><Text style={s.dropPercent}>↓ {discount}%</Text></View>:null}<Text style={s.wantPrice}>${p.price.toFixed(2)}</Text><View style={s.wantMeta}><Rating value={p.rating} size={11}/><Text style={s.hypeScore}>🔥 {p.recommend}%</Text></View></View></Pressable>})}</View>}
  </ScrollView>;
}

function ReviewScreen({catalog,onSubmitted}:{catalog:Product[];onSubmitted:()=>void}) { const [rating,setRating]=useState(0); const [text,setText]=useState(''); const [worth,setWorth]=useState<boolean|null>(null); const [media,setMedia]=useState<ImagePicker.ImagePickerAsset|null>(null); const [mediaKind,setMediaKind]=useState<'image'|'video'|null>(null); const {session}=useAuth(); const queryClient=useQueryClient(); const create=useCreateReview(); const product=catalog[0]; const pick=async(kind:'image'|'video')=>{const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!permission.granted)return Alert.alert('Permission needed','Allow library access to add review media.');const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:[kind==='image'?'images':'videos'] as any,quality:0.8});if(!result.canceled){setMedia(result.assets[0]);setMediaKind(kind);}}; const upload=async()=>{if(!media||!mediaKind)return null;const bucket=mediaKind==='image'?'review-images':'review-videos';const signed=await getUploadUrl({bucket,filename:media.fileName||`review-${Date.now()}`,contentType:media.mimeType||undefined});const response=await expoFetch(signed.uploadUrl,{method:'PUT',headers:{'Content-Type':media.mimeType||'application/octet-stream'},body:new File(media.uri)});if(!response.ok){const details=await response.text().catch(()=> '');throw new Error(`Media upload failed (HTTP ${response.status})${details?`: ${details}`:''}`);}return signed.mediaUrl;}; const submit=async()=>{if(!session)return Alert.alert('Sign in to post','Create an account or sign in before posting a review.');if(!rating||worth===null||(!text.trim()&&!media))return Alert.alert('Almost there','Add a rating, choose worth it, and include a note, photo, or video.');try{const path=await upload();await create.mutateAsync({data:{productId:product.id,rating,worthIt:worth,reviewText:text.trim(),photoUrl:mediaKind==='image'?path:null,videoUrl:mediaKind==='video'?path:null}});await Promise.all([queryClient.invalidateQueries({queryKey:getGetProfileReviewsQueryKey()}),queryClient.invalidateQueries({queryKey:getGetProductReviewsQueryKey(product.id)}),queryClient.invalidateQueries({queryKey:getGetProductQueryKey(product.id)}),queryClient.invalidateQueries({queryKey:getListProductsQueryKey()})]);Alert.alert('Review posted','Thanks for helping the community shop smarter.');onSubmitted();}catch(error){Alert.alert('Could not post review',error instanceof Error?error.message:'Please try again.');}}; return <ScrollView style={s.page} contentContainerStyle={s.scrollPad}><Header title="Share your take" subtitle="Help someone shop smarter."/><Text style={s.formLabel}>Product</Text><View style={s.selectBox}><Image source={product.image} style={s.selectImage}/><Text style={s.selectText}>{product.name}</Text><Feather name="check" size={18} color={colors.primary}/></View><Text style={s.formLabel}>Your rating</Text><View style={s.starPicker}>{[1,2,3,4,5].map(n=><Pressable key={n} onPress={()=>setRating(n)}><Ionicons name={n<=rating?'star':'star-outline'} size={35} color={colors.accentForeground}/></Pressable>)}</View><Text style={s.formLabel}>Worth it?</Text><View style={s.choiceRow}><Pressable onPress={()=>setWorth(true)} style={[s.choice,worth===true&&s.choiceActive]}><Ionicons name="thumbs-up-outline" size={18} color={worth===true?'#fff':colors.primary}/><Text style={[s.choiceText,worth===true&&s.choiceTextActive]}>Yes, worth it</Text></Pressable><Pressable onPress={()=>setWorth(false)} style={[s.choice,worth===false&&s.choiceActive]}><Ionicons name="thumbs-down-outline" size={18} color={worth===false?'#fff':colors.primary}/><Text style={[s.choiceText,worth===false&&s.choiceTextActive]}>Not really</Text></Pressable></View><Text style={s.formLabel}>Tell us more</Text><TextInput value={text} onChangeText={setText} multiline placeholder="What should shoppers know?" placeholderTextColor={colors.mutedForeground} style={[s.input,s.textArea]}/><View style={s.mediaRow}><Pressable onPress={()=>pick('image')} style={s.mediaButton}><Feather name="image" size={18} color={colors.primary}/><Text style={s.mediaText}>{mediaKind==='image'?'Photo added':'Add photo'}</Text></Pressable><Pressable onPress={()=>pick('video')} style={s.mediaButton}><Feather name="video" size={18} color={colors.primary}/><Text style={s.mediaText}>{mediaKind==='video'?'Video added':'Add video'}</Text></Pressable></View><Pressable disabled={create.isPending} onPress={submit} style={[s.primaryButton,create.isPending&&{opacity:.6}]}><Text style={s.primaryText}>{create.isPending?'Posting…':'Post Review'}</Text><Feather name="send" size={17} color="#fff"/></Pressable></ScrollView>; }

function ProfileScreen({catalog,wants,onDetail}:{catalog:Product[];wants:string[];onDetail:(product:Product)=>void}) {
  const {session,signOut}=useAuth();
  const {profile,setProfile,refreshProfile}=useProfile();
  const insets=useSafeAreaInsets();
  const profileReviews=useGetProfileReviews(undefined,{query:{queryKey:getGetProfileReviewsQueryKey(),enabled:!!session,retry:false}});
  const updateProfile=useUpdateProfile();
  const [activeTab,setActiveTab]=useState<'Reviews'|'Wants'|'Lists'>('Reviews');
  const [avatarPreview,setAvatarPreview]=useState<string|null>(null);
  const [avatarUploading,setAvatarUploading]=useState(false);
  const [listModalVisible,setListModalVisible]=useState(false);
  const [editProfileVisible,setEditProfileVisible]=useState(false);
  const [draftDisplayName,setDraftDisplayName]=useState('');
  const [draftUsername,setDraftUsername]=useState('');
  const [draftBio,setDraftBio]=useState('');
  const username=profile?.username||session?.user.email?.split('@')[0]||'Guest';
  const normalizedDraftUsername=draftUsername.trim().toLowerCase();
  const validDraftUsername=/^[a-z0-9][a-z0-9_.-]{2,23}$/.test(normalizedDraftUsername);
  const usernameChanged=normalizedDraftUsername!==profile?.username;
  const usernameAvailability=useCheckUsernameAvailability({username:normalizedDraftUsername},{query:{queryKey:getCheckUsernameAvailabilityQueryKey({username:normalizedDraftUsername}),enabled:!!session&&editProfileVisible&&validDraftUsername&&usernameChanged,retry:false}});
  const liveReviews=profileReviews.data?.items??[];
  const reviewCount=profileReviews.data?.total??liveReviews.length;
  const savedProducts=useMemo(()=>catalog.filter(product=>wants.includes(product.id)),[catalog,wants]);
  const avatarUri=avatarPreview??profile?.avatarUrl??null;
  const uploadAvatar=async()=>{
    if(!session)return Alert.alert('Sign in to add a photo','Create an account or sign in before updating your profile picture.');
    const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
    if(!permission.granted)return Alert.alert('Permission needed','Allow library access to choose a profile picture.');
    const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'] as any,quality:0.8});
    if(result.canceled)return;
    const asset=result.assets?.[0];
    if(!asset?.uri)return Alert.alert('Could not read photo','Expo did not return a local image URI.');
    setAvatarPreview(asset.uri);
    setAvatarUploading(true);
    try{
      const signed=await getUploadUrl({bucket:'avatars',filename:asset.fileName||`avatar-${Date.now()}.jpg`,contentType:asset.mimeType||'image/jpeg'});
      const response=await expoFetch(signed.uploadUrl,{method:'PUT',headers:{'Content-Type':asset.mimeType||'image/jpeg'},body:new File(asset.uri)});
      if(!response.ok){const body=await response.text().catch(()=>'' );throw new Error(`Avatar Storage upload failed (HTTP ${response.status})${body?`: ${body}`:''}`);}
      const updated=await updateProfile.mutateAsync({data:{avatarUrl:signed.mediaUrl}});
      const avatarUrl=updated.avatarUrl||signed.mediaUrl;
      setAvatarPreview(avatarUrl);
      setProfile(updated);
      await refreshProfile();
      Alert.alert('Profile updated','Your profile photo has been updated.');
    }catch(error){
      setAvatarPreview(null);
      console.error('[HypeCheck avatar] upload failed',error);
      Alert.alert('Could not update photo',error instanceof Error?error.message:'The avatar upload failed without an error message.');
    }finally{setAvatarUploading(false);}
  };
  const openProfileEditor=()=>{
    if(!profile)return;
    setDraftDisplayName(profile.displayName||'');
    setDraftUsername(profile.username||'');
    setDraftBio(profile.bio||'');
    setEditProfileVisible(true);
  };
  const saveProfile=async()=>{
    const displayName=draftDisplayName.trim();
    const bio=draftBio.trim();
    if(!displayName)return Alert.alert('Add a display name','Enter the name you want people to see.');
    if(displayName.length>60)return Alert.alert('Display name is too long','Keep your display name to 60 characters or fewer.');
    if(!validDraftUsername)return Alert.alert('Choose a valid username','Use 3–24 lowercase letters, numbers, periods, hyphens, or underscores.');
    if(draftBio.length>150)return Alert.alert('Bio is too long','Keep your bio to 150 characters or fewer.');
    if(usernameChanged&&usernameAvailability.isFetching)return Alert.alert('Checking username','Please wait while we check whether this username is available.');
    if(usernameChanged&&usernameAvailability.data&&!usernameAvailability.data.available)return Alert.alert('Username unavailable','That username is already taken. Try another one.');
    try{
      const updated=await updateProfile.mutateAsync({data:{displayName,username:normalizedDraftUsername,bio}});
      setProfile(updated);
      setEditProfileVisible(false);
      await refreshProfile();
      Alert.alert('Profile updated','Your changes have been saved.');
    }catch(error){
      Alert.alert('Could not update profile',error instanceof Error?error.message:'Please try again.');
    }
  };
  const selectTab=(nextTab:'Reviews'|'Wants'|'Lists')=>setActiveTab(nextTab);
  const renderTabContent=()=>{
    if(activeTab==='Reviews'){
      if(!session||liveReviews.length===0)return <View style={profileStyles.emptyState}><Ionicons name="chatbubble-ellipses-outline" size={30} color={colors.primary}/><Text style={s.emptyTitle}>No reviews yet</Text><Text style={[s.muted,s.emptyCopy]}>{session?'Products you review will appear here.':'Sign in to see reviews connected to your profile.'}</Text></View>;
      return <View style={profileStyles.tabContent}>{liveReviews.map(review=><View key={review.id} style={s.profileReview}>{review.photoUrl?<Image source={{uri:review.photoUrl}} style={profileStyles.reviewPhoto}/>:null}{review.videoUrl?<VideoReviewPreview videoUrl={review.videoUrl}/>:null}<View style={s.reviewHead}><Text style={s.reviewerName}>Your review</Text><Rating value={review.rating} size={12}/></View><Text style={s.reviewText}>{review.reviewText||'Video review'}</Text><Text style={s.helpful}>{new Date(review.createdAt).toLocaleDateString()}</Text></View>)}</View>;
    }
    if(activeTab==='Wants'){
      if(!session)return <View style={profileStyles.emptyState}><View style={s.emptyHeart}><Ionicons name="lock-closed-outline" size={28} color={colors.primary}/></View><Text style={s.emptyTitle}>Sign in to see your Wants</Text><Text style={[s.muted,s.emptyCopy]}>Create an account or sign in to view the products you have saved.</Text></View>;
      if(savedProducts.length===0)return <View style={profileStyles.emptyState}><View style={s.emptyHeart}><Ionicons name="heart-outline" size={30} color={colors.primary}/></View><Text style={s.emptyTitle}>No Wants yet</Text><Text style={[s.muted,s.emptyCopy]}>Swipe right on products you like and they&apos;ll show up here.</Text></View>;
      return <View style={profileStyles.tabContent}>{savedProducts.map(product=><Pressable key={product.id} testID={`profile-want-${product.id}`} accessibilityRole="button" accessibilityLabel={`Open ${product.name}`} onPress={()=>onDetail(product)} style={profileStyles.wantRow}><Image source={product.image} style={profileStyles.wantImage}/><View style={profileStyles.wantInfo}><Text style={s.resultCategory}>{product.category}</Text><Text numberOfLines={2} style={s.resultName}>{product.name}</Text><Text style={s.resultPrice}>${product.price.toFixed(2)}</Text></View><Feather name="chevron-right" size={19} color={colors.mutedForeground}/></Pressable>)}</View>;
    }
    return <View style={profileStyles.emptyState}><Ionicons name="list-outline" size={32} color={colors.primary}/><Text style={s.emptyTitle}>No lists yet</Text><Text style={[s.muted,s.emptyCopy]}>Create lists to organize products you want.</Text><Pressable testID="create-list-placeholder" accessibilityRole="button" onPress={()=>setListModalVisible(true)} style={[s.primaryButton,profileStyles.createListButton]}><Text style={s.primaryText}>Create List</Text><Feather name="plus" size={17} color="#fff"/></Pressable></View>;
  };
  return <ScrollView style={s.page} contentContainerStyle={[s.scrollPad,profileStyles.content,{paddingTop:insets.top+14}]}>
    <View style={profileStyles.header}>
      <Pressable disabled={avatarUploading} accessibilityRole="button" accessibilityLabel="Edit profile photo" onPress={uploadAvatar} style={[profileStyles.avatar,{overflow:'hidden'}]}>{avatarUri?<Image source={{uri:avatarUri}} style={profileStyles.avatarImage}/>:<Text style={s.profileInitial}>{username[0].toUpperCase()}</Text>}</Pressable>
      <View style={profileStyles.identity}>
        <Text style={s.profileName}>{session?(profile?.displayName||username):'Discover as a guest'}</Text>
        <Text style={s.handle}>{session?`@${username}`:'Sign in to sync your profile'}</Text>
        <Text style={s.bio}>{session?(profile?.bio||'No bio yet.'):'Create an account to save products and share reviews.'}</Text>
      </View>
    </View>
    {session?<View style={profileStyles.actions}><Pressable testID="edit-profile" accessibilityRole="button" onPress={openProfileEditor} style={profileStyles.editButton}><Feather name="edit-2" size={15} color={colors.primary}/><Text style={profileStyles.editText}>Edit profile</Text></Pressable><Pressable accessibilityRole="button" onPress={()=>signOut().catch(error=>Alert.alert('Could not sign out',error instanceof Error?error.message:'Please try again.'))} style={profileStyles.signOutButton}><Text style={profileStyles.signOutText}>Sign out</Text></Pressable></View>:null}
    <View style={profileStyles.stats}>{[{label:'Reviews',value:reviewCount},{label:'Followers',value:0},{label:'Following',value:0},{label:'Helpful votes',value:0}].map(stat=><View key={stat.label} style={profileStyles.stat}><Text style={s.statBig}>{stat.value}</Text><Text style={s.statLabel}>{stat.label}</Text></View>)}</View>
    <View style={profileStyles.tabs}>{(['Reviews','Wants','Lists'] as const).map(tabName=><Pressable key={tabName} testID={`profile-tab-${tabName.toLowerCase()}`} accessibilityRole="tab" accessibilityState={{selected:activeTab===tabName}} onPress={()=>selectTab(tabName)} style={profileStyles.tab}><Text style={[profileStyles.tabText,activeTab===tabName&&profileStyles.tabTextActive]}>{tabName==='Wants'?`Wants (${session?wants.length:0})`:tabName}</Text>{activeTab===tabName?<View style={profileStyles.tabIndicator}/>:null}</Pressable>)}</View>
    {renderTabContent()}
    <Modal transparent visible={listModalVisible} animationType="fade" onRequestClose={()=>setListModalVisible(false)}><View style={profileStyles.modalBackdrop}><View style={profileStyles.listModal}><Ionicons name="list-outline" size={28} color={colors.primary}/><Text style={profileStyles.modalTitle}>Lists are coming soon</Text><Text style={[s.muted,profileStyles.modalCopy]}>Custom Lists are not available in this prototype yet.</Text><Pressable testID="close-list-placeholder" accessibilityRole="button" onPress={()=>setListModalVisible(false)} style={s.primaryButton}><Text style={s.primaryText}>Got it</Text></Pressable></View></View></Modal>
    <Modal transparent visible={editProfileVisible} animationType="slide" onRequestClose={()=>setEditProfileVisible(false)}>
      <View style={profileStyles.editorBackdrop}>
        <ScrollView style={profileStyles.editorScrollView} contentContainerStyle={profileStyles.editorScroll} keyboardShouldPersistTaps="handled">
          <View style={[profileStyles.editorModal,{paddingTop:insets.top+8}]}>
            <View style={profileStyles.editorHeader}><Pressable testID="cancel-edit-profile-top" accessibilityRole="button" accessibilityLabel="Back to profile" onPress={()=>setEditProfileVisible(false)} style={profileStyles.closeButton}><Feather name="arrow-left" size={22} color={colors.foreground}/></Pressable><Text style={profileStyles.modalTitle}>Edit profile</Text><View style={profileStyles.headerSpacer}/></View>
            <View style={profileStyles.photoEditor}><View style={profileStyles.editorAvatarWrap}><Pressable testID="change-profile-photo" disabled={avatarUploading} accessibilityRole="button" accessibilityLabel="Change profile photo" onPress={uploadAvatar} style={[profileStyles.avatar,profileStyles.editorAvatar,{overflow:'hidden'}]}>{avatarUri?<Image source={{uri:avatarUri}} style={profileStyles.avatarImage}/>:<Text style={s.profileInitial}>{username[0].toUpperCase()}</Text>}<View style={profileStyles.cameraBadge}><Feather name="camera" size={14} color="#fff"/></View></Pressable></View><View style={profileStyles.photoEditorCopy}><Text style={profileStyles.fieldLabel}>Profile photo</Text><Pressable disabled={avatarUploading} accessibilityRole="button" onPress={uploadAvatar}><Text style={profileStyles.changePhotoText}>{avatarUploading?'Uploading…':'Change photo'}</Text></Pressable></View></View>
            <Text style={profileStyles.fieldLabel}>Display name</Text>
            <TextInput testID="edit-profile-display-name" value={draftDisplayName} onChangeText={setDraftDisplayName} maxLength={60} placeholder="Your name" placeholderTextColor={colors.mutedForeground} style={profileStyles.editorInput}/>
            <Text style={profileStyles.fieldLabel}>Username</Text>
            <View style={profileStyles.usernameInputRow}><Text style={profileStyles.usernamePrefix}>@</Text><TextInput testID="edit-profile-username" value={draftUsername} onChangeText={setDraftUsername} autoCapitalize="none" autoCorrect={false} maxLength={24} placeholder="your-username" placeholderTextColor={colors.mutedForeground} style={profileStyles.usernameInput}/></View>
            {normalizedDraftUsername&&!validDraftUsername?<Text style={profileStyles.validationText}>Use 3–24 lowercase letters, numbers, periods, hyphens, or underscores.</Text>:null}
            {validDraftUsername&&usernameChanged&&usernameAvailability.isFetching?<Text style={profileStyles.mutedHint}>Checking username…</Text>:null}
            {validDraftUsername&&usernameChanged&&usernameAvailability.data?.available?<Text style={profileStyles.availableText}>Username is available</Text>:null}
            {validDraftUsername&&usernameChanged&&usernameAvailability.data&&!usernameAvailability.data.available?<Text style={profileStyles.validationText}>That username is already taken.</Text>:null}
            {validDraftUsername&&usernameChanged&&usernameAvailability.isError?<Text style={profileStyles.validationText}>Couldn&apos;t check this username yet. We&apos;ll confirm it when you save.</Text>:null}
            <View style={profileStyles.bioLabelRow}><Text style={profileStyles.fieldLabel}>Bio</Text><Text style={profileStyles.characterCount}>{draftBio.length}/150</Text></View>
            <TextInput testID="edit-profile-bio" value={draftBio} onChangeText={setDraftBio} maxLength={150} multiline textAlignVertical="top" placeholder="Tell people a little about yourself" placeholderTextColor={colors.mutedForeground} style={[profileStyles.editorInput,profileStyles.bioInput]}/>
            <View style={profileStyles.editorActions}><Pressable testID="cancel-edit-profile" accessibilityRole="button" onPress={()=>setEditProfileVisible(false)} style={profileStyles.cancelButton}><Text style={profileStyles.cancelText}>Cancel</Text></Pressable><Pressable testID="save-profile" accessibilityRole="button" disabled={updateProfile.isPending||avatarUploading} onPress={saveProfile} style={[s.primaryButton,profileStyles.saveButton,(updateProfile.isPending||avatarUploading)&&profileStyles.saveDisabled]}><Text style={s.primaryText}>{updateProfile.isPending?'Saving…':'Save changes'}</Text></Pressable></View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  </ScrollView>;
}

export default function DiscoverTab() {
  const [onboarded,setOnboarded]=useState(false); const [tab,setTab]=useState('Discover'); const [optimisticAdds,setOptimisticAdds]=useState<string[]>([]); const [optimisticRemovals,setOptimisticRemovals]=useState<string[]>([]); const [detail,setDetail]=useState<Product|null>(null);
  const { session }=useAuth();
  const productsQuery=useListProducts(undefined,{query:{queryKey:getListProductsQueryKey(),retry:false}});
  const catalog=productsQuery.data?.items?.map(toDisplayProduct)??[];
  const wantsQuery=useGetWants({query:{queryKey:getGetWantsQueryKey(),retry:false,enabled:!!session}}); const saveWant=useSaveWant(); const removeWant=useRemoveWant();
  const remoteWants=wantsQuery.data?.items.map(item=>item.productId)??[]; const wants=Array.from(new Set([...remoteWants,...optimisticAdds])).filter(id=>!optimisticRemovals.includes(id));
  const addWant=(id:string)=>{if(!session)return Alert.alert('Sign in to save','Create an account or sign in to save products to your Wants.');if(wants.includes(id))return;setOptimisticRemovals(value=>value.filter(item=>item!==id));setOptimisticAdds(value=>[...value,id]);saveWant.mutate({data:{productId:id}},{onSuccess:()=>wantsQuery.refetch(),onError:(error)=>{setOptimisticAdds(value=>value.filter(item=>item!==id));Alert.alert('Could not save Want',error instanceof Error?error.message:'The Supabase Wants request failed without an error message.');}});};
  const removeWantById=(id:string)=>{if(!session)return;setOptimisticRemovals(value=>[...value,id]);setOptimisticAdds(value=>value.filter(item=>item!==id));removeWant.mutate({params:{productId:id}},{onSuccess:()=>wantsQuery.refetch(),onError:()=>{setOptimisticRemovals(value=>value.filter(item=>item!==id));Alert.alert('Could not remove Want','Supabase could not update your Wants.');}});};
  const setWants=(next:string[])=>{next.filter(id=>!wants.includes(id)).forEach(addWant);wants.filter(id=>!next.includes(id)).forEach(removeWantById);};
  if(!onboarded)return <Onboarding onDone={()=>setOnboarded(true)}/>;
  if(productsQuery.isLoading)return <View style={[s.page,s.emptyTab]}><Text style={s.emptyTitle}>Loading live products…</Text><Text style={s.muted}>Connecting to Supabase.</Text></View>;
  if(productsQuery.isError||!catalog.length){const message=productsQuery.error instanceof Error?productsQuery.error.message:'The live Supabase catalog returned no products.';return <View style={[s.page,s.emptyTab]}><Text style={s.emptyTitle}>Could not load live products</Text><Text style={[s.muted,s.emptyCopy]}>{message}</Text><Pressable onPress={()=>productsQuery.refetch()} style={[s.primaryButton,s.discoverButton]}><Text style={s.primaryText}>Try again</Text></Pressable></View>;}
  if(detail)return <Detail product={detail} onBack={()=>setDetail(null)} onWant={()=>wants.includes(detail.id)?removeWantById(detail.id):addWant(detail.id)} wanted={wants.includes(detail.id)}/>;
  return <>
    {tab==='Discover'&&<Discover catalog={catalog} wants={wants} setWants={setWants} onDetail={setDetail} onProfile={()=>setTab('Profile')}/>}
    {tab==='Search'&&<SearchScreen catalog={catalog} onDetail={setDetail}/>}
    {tab==='Review'&&<ReviewScreen catalog={catalog} onSubmitted={()=>setTab('Profile')}/>}
    {tab==='Wants'&&<WantsScreen catalog={catalog} wants={wants} onDetail={setDetail} onRemove={removeWantById} onDiscover={()=>setTab('Discover')} isLoading={!!session&&wantsQuery.isLoading} error={!!session&&wantsQuery.isError}/>}
    {tab==='Profile'&&<ProfileScreen catalog={catalog} wants={wants} onDetail={setDetail}/>}
    <View style={s.floatingNav}>{[['Discover','home'],['Search','search'],['Review','edit-3'],['Wants','heart'],['Profile','user']].map(([name,icon])=><Pressable key={name} onPress={()=>setTab(name)} style={s.navItem}><Feather name={icon as any} size={20} color={tab===name?colors.primary:colors.mutedForeground}/><Text style={[s.navLabel,tab===name&&s.navLabelActive]}>{name}</Text></Pressable>)}</View>
  </>;
}

const s=StyleSheet.create({
  screen:{flex:1,backgroundColor:colors.background}, page:{flex:1,backgroundColor:colors.background}, scrollPad:{paddingHorizontal:18,paddingBottom:100}, header:{paddingHorizontal:18,paddingBottom:12,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}, brand:{fontFamily:'Inter_700Bold',fontSize:16,color:colors.primary,letterSpacing:-.4}, headerTitle:{fontFamily:'Inter_700Bold',fontSize:28,color:colors.foreground,marginTop:4,letterSpacing:-1}, muted:{fontFamily:'Inter_400Regular',fontSize:13,color:colors.mutedForeground,lineHeight:19}, avatar:{width:38,height:38,borderRadius:19,backgroundColor:'#F4C8AE',alignItems:'center',justifyContent:'center'},avatarText:{fontFamily:'Inter_700Bold',color:'#7D4735'}, discoverTop:{paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:10},feedPill:{backgroundColor:colors.foreground,paddingHorizontal:14,paddingVertical:7,borderRadius:16},feedPillText:{color:'#fff',fontFamily:'Inter_600SemiBold',fontSize:12},swipeHint:{fontFamily:'Inter_400Regular',fontSize:12,color:colors.mutedForeground},cardStage:{flex:1,paddingHorizontal:16},productCard:{flex:1,backgroundColor:'#fff',borderRadius:25,overflow:'hidden',shadowColor:'#2B1818',shadowOpacity:.12,shadowRadius:15,shadowOffset:{width:0,height:8},elevation:5},activeCard:{zIndex:2},stackedCard:{position:'absolute',left:22,right:22,top:10,bottom:0,opacity:.62,transform:[{scale:.965}]},cardImageWrap:{height:'76%' as any},cardImage:{width:'100%',height:'100%',resizeMode:'cover'},videoScrim:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(12,8,18,.17)'},videoPlay:{position:'absolute',top:'42%' as any,left:'46%' as any,width:48,height:48,borderRadius:24,backgroundColor:'rgba(0,0,0,.4)',alignItems:'center',justifyContent:'center'},videoBadge:{position:'absolute',top:16,left:16,flexDirection:'row',alignItems:'center',backgroundColor:'rgba(0,0,0,.55)',paddingHorizontal:10,paddingVertical:7,borderRadius:14,gap:5},videoText:{fontFamily:'Inter_700Bold',fontSize:11,color:'#fff',letterSpacing:.6},actionRail:{position:'absolute',right:13,bottom:24,gap:12,alignItems:'center'},railButton:{alignItems:'center',gap:3},railCount:{fontFamily:'Inter_600SemiBold',fontSize:10,color:'#fff'},cardOverlay:{position:'absolute',left:18,right:62,bottom:18},categoryLabel:{fontFamily:'Inter_700Bold',fontSize:11,color:colors.primary,letterSpacing:1.3},cardTitle:{fontFamily:'Inter_700Bold',fontSize:27,color:'#fff',letterSpacing:-.8,marginTop:5},cardPrice:{fontFamily:'Inter_700Bold',fontSize:21,color:'#fff'},glanceRow:{flexDirection:'row',alignItems:'center',gap:8,marginTop:8},cardMeta:{flexDirection:'row',alignItems:'center',gap:8,marginTop:7},rating:{flexDirection:'row',alignItems:'center',gap:2},ratingText:{fontFamily:'Inter_600SemiBold',fontSize:12,color:colors.foreground,marginLeft:3},reviewCount:{fontFamily:'Inter_400Regular',fontSize:12,color:colors.mutedForeground},recommend:{flexDirection:'row',alignItems:'baseline',marginTop:8},recommendNumber:{fontFamily:'Inter_700Bold',fontSize:18,color:'#fff'},recommendText:{fontFamily:'Inter_400Regular',fontSize:12,color:'rgba(255,255,255,.8)'},reviewQuote:{padding:14},reviewerRow:{flexDirection:'row',alignItems:'center',gap:8},miniAvatar:{width:25,height:25,borderRadius:13,backgroundColor:'#F4C8AE',alignItems:'center',justifyContent:'center'},reviewerName:{fontFamily:'Inter_600SemiBold',fontSize:13,color:colors.foreground},quoteActions:{marginLeft:'auto' as any,flexDirection:'row',alignItems:'center',gap:5},actionCount:{fontFamily:'Inter_400Regular',fontSize:11,color:colors.mutedForeground,marginRight:4},quote:{fontFamily:'Inter_500Medium',fontSize:14,color:colors.foreground,marginTop:8},decisionBadge:{position:'absolute',top:52,zIndex:5,flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:13,paddingVertical:8,borderRadius:12,borderWidth:2},wantBadge:{left:18,borderColor:'#fff',backgroundColor:'rgba(255,90,95,.9)',transform:[{rotate:'-8deg'}]},passBadge:{right:18,borderColor:'#fff',backgroundColor:'rgba(92,82,94,.9)',transform:[{rotate:'8deg'}]},decisionText:{fontFamily:'Inter_700Bold',fontSize:14,color:'#fff',letterSpacing:1},decisionPulse:{position:'absolute',top:'40%' as any,left:'42%' as any,zIndex:6,width:66,height:66,borderRadius:33,backgroundColor:'rgba(255,90,95,.86)',alignItems:'center',justifyContent:'center'},swipeActions:{height:82,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:28},roundAction:{width:58,height:58,borderRadius:29,alignItems:'center',justifyContent:'center',shadowColor:'#000',shadowOpacity:.08,shadowRadius:8,elevation:3},passAction:{backgroundColor:'#FFF0EF',borderWidth:1,borderColor:'#F6D0D0'},wantAction:{backgroundColor:colors.primary},bottomNote:{textAlign:'center',fontFamily:'Inter_400Regular',fontSize:11,color:colors.mutedForeground,paddingBottom:8},floatingNav:{position:'absolute',left:10,right:10,bottom:8,height:68,borderRadius:24,backgroundColor:'rgba(255,252,250,.96)',borderWidth:1,borderColor:colors.border,flexDirection:'row',justifyContent:'space-around',alignItems:'center',shadowColor:'#000',shadowOpacity:.08,shadowRadius:12,elevation:4},navItem:{alignItems:'center',gap:3,paddingHorizontal:10},navLabel:{fontFamily:'Inter_500Medium',fontSize:10,color:colors.mutedForeground},navLabelActive:{color:colors.primary}, onboarding:{flex:1,backgroundColor:'#FFF7F1',padding:28,justifyContent:'center'},onboardMark:{width:70,height:70,borderRadius:24,backgroundColor:colors.primary,alignItems:'center',justifyContent:'center',marginBottom:16},onboardBrand:{fontFamily:'Inter_700Bold',fontSize:24,color:colors.foreground},onboardTitle:{fontFamily:'Inter_700Bold',fontSize:42,lineHeight:46,letterSpacing:-1.8,color:colors.foreground,marginTop:72},onboardTitleSmall:{fontFamily:'Inter_700Bold',fontSize:32,lineHeight:37,letterSpacing:-1,color:colors.foreground,marginTop:64},onboardCopy:{fontFamily:'Inter_400Regular',fontSize:16,lineHeight:24,color:colors.mutedForeground,marginTop:16,maxWidth:320},onboardFooter:{marginTop:54},dots:{flexDirection:'row',gap:7,marginBottom:20},dot:{width:7,height:7,borderRadius:4,backgroundColor:'#EBCBC3'},dotActive:{width:24,backgroundColor:colors.primary},primaryButton:{backgroundColor:colors.primary,borderRadius:16,minHeight:54,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},primaryText:{fontFamily:'Inter_700Bold',fontSize:15,color:'#fff'},skip:{fontFamily:'Inter_500Medium',fontSize:13,color:colors.mutedForeground,textAlign:'center',marginTop:16},categoryGrid:{flexDirection:'row',flexWrap:'wrap',gap:10,marginTop:28},chip:{paddingHorizontal:15,paddingVertical:11,borderRadius:18,backgroundColor:'#fff',borderWidth:1,borderColor:colors.border},chipActive:{backgroundColor:colors.primary,borderColor:colors.primary},chipText:{fontFamily:'Inter_600SemiBold',fontSize:13,color:colors.foreground},chipTextActive:{color:'#fff'},input:{backgroundColor:'#fff',borderWidth:1,borderColor:colors.border,borderRadius:15,minHeight:52,paddingHorizontal:15,fontFamily:'Inter_400Regular',fontSize:15,color:colors.foreground,marginTop:12},detailHero:{height:350,position:'relative'},detailImage:{width:'100%',height:'100%',resizeMode:'cover'},backButton:{position:'absolute',top:52,left:18,width:40,height:40,borderRadius:20,backgroundColor:'rgba(0,0,0,.45)',alignItems:'center',justifyContent:'center'},shareButton:{position:'absolute',top:52,right:18,width:40,height:40,borderRadius:20,backgroundColor:'rgba(0,0,0,.45)',alignItems:'center',justifyContent:'center'},detailBody:{padding:20},detailTitle:{fontFamily:'Inter_700Bold',fontSize:30,letterSpacing:-1,color:colors.foreground,marginTop:5},detailDescription:{fontFamily:'Inter_400Regular',fontSize:15,lineHeight:22,color:colors.mutedForeground,marginTop:8},detailStats:{marginTop:20,paddingVertical:16,borderTopWidth:1,borderBottomWidth:1,borderColor:colors.border,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},detailPrice:{fontFamily:'Inter_700Bold',fontSize:23,color:colors.foreground,marginBottom:5},statDivider:{width:1,height:38,backgroundColor:colors.border},statBig:{fontFamily:'Inter_700Bold',fontSize:18,color:colors.foreground},statLabel:{fontFamily:'Inter_400Regular',fontSize:11,color:colors.mutedForeground,marginTop:3},detailButtons:{flexDirection:'row',gap:10,marginTop:18},flexButton:{flex:1},outlineButton:{flex:1,borderWidth:1,borderColor:colors.primary,borderRadius:16,minHeight:54,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:7},outlineText:{fontFamily:'Inter_700Bold',fontSize:13,color:colors.primary},sectionHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:28,marginBottom:12},sectionTitle:{fontFamily:'Inter_700Bold',fontSize:18,color:colors.foreground,letterSpacing:-.3},tabs:{flexDirection:'row',borderBottomWidth:1,borderColor:colors.border,gap:24},detailTab:{paddingVertical:12},detailTabActive:{borderBottomWidth:2,borderColor:colors.primary},detailTabText:{fontFamily:'Inter_600SemiBold',fontSize:13,color:colors.mutedForeground},detailTabTextActive:{color:colors.primary},reviewItem:{paddingVertical:18,borderBottomWidth:1,borderColor:colors.border},reviewThumb:{width:'100%',height:130,borderRadius:14,marginBottom:12},reviewHead:{flexDirection:'row',alignItems:'center',gap:8},date:{fontFamily:'Inter_400Regular',fontSize:11,color:colors.mutedForeground},reviewText:{fontFamily:'Inter_400Regular',fontSize:14,lineHeight:21,color:colors.foreground,marginTop:10},reviewFooter:{flexDirection:'row',gap:18,marginTop:13},helpful:{fontFamily:'Inter_400Regular',fontSize:12,color:colors.mutedForeground},emptyTab:{alignItems:'center',justifyContent:'center',padding:50,gap:8},emptyTitle:{fontFamily:'Inter_700Bold',fontSize:17,color:colors.foreground},emptyHeart:{width:70,height:70,borderRadius:35,backgroundColor:colors.secondary,alignItems:'center',justifyContent:'center'},emptyCopy:{textAlign:'center',maxWidth:250},discoverButton:{marginTop:16,minWidth:200},syncNotice:{marginHorizontal:18,marginTop:4,marginBottom:2,backgroundColor:colors.secondary,borderRadius:12,padding:10,flexDirection:'row',gap:8,alignItems:'center'},syncText:{fontFamily:'Inter_500Medium',fontSize:12,color:colors.secondaryForeground,flex:1},filterRow:{gap:9,paddingRight:18},wantsToolbar:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:3,marginBottom:14},savedLabel:{fontFamily:'Inter_600SemiBold',fontSize:13,color:colors.mutedForeground},sortButton:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#fff',borderWidth:1,borderColor:colors.border,borderRadius:12,paddingHorizontal:10,paddingVertical:8},sortText:{fontFamily:'Inter_600SemiBold',fontSize:11,color:colors.foreground,maxWidth:116},sortMenu:{backgroundColor:'#fff',borderWidth:1,borderColor:colors.border,borderRadius:14,overflow:'hidden',marginBottom:14},sortOption:{paddingHorizontal:14,paddingVertical:13,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderColor:colors.border},sortOptionActive:{backgroundColor:colors.secondary},sortOptionText:{fontFamily:'Inter_500Medium',fontSize:13,color:colors.foreground},sortOptionTextActive:{fontFamily:'Inter_700Bold',color:colors.primary},searchBox:{flexDirection:'row',alignItems:'center',backgroundColor:colors.muted,borderRadius:15,paddingHorizontal:14,height:50,gap:9},searchInput:{flex:1,fontFamily:'Inter_400Regular',fontSize:15,color:colors.foreground},horizontalChips:{marginVertical:14},resultRow:{flexDirection:'row',alignItems:'center',paddingVertical:12,borderBottomWidth:1,borderColor:colors.border,gap:12},resultImage:{width:68,height:68,borderRadius:14},resultInfo:{flex:1},resultCategory:{fontFamily:'Inter_500Medium',fontSize:11,color:colors.primary,marginBottom:3},resultName:{fontFamily:'Inter_600SemiBold',fontSize:15,color:colors.foreground,marginBottom:5},resultPrice:{fontFamily:'Inter_700Bold',fontSize:13,color:colors.foreground,marginTop:4},viewToggle:{flexDirection:'row',gap:12},wantGrid:{flexDirection:'row',flexWrap:'wrap',gap:12},wantCard:{width:'48%' as any,backgroundColor:'#fff',borderRadius:18,overflow:'hidden',shadowColor:'#2B1818',shadowOpacity:.06,shadowRadius:8,shadowOffset:{width:0,height:3},elevation:2},wantImage:{width:'100%',height:155},wantContent:{padding:10},wantCategory:{position:'absolute',left:8,top:8,backgroundColor:'rgba(255,255,255,.9)',borderRadius:10,paddingHorizontal:8,paddingVertical:4},wantCategoryText:{fontFamily:'Inter_700Bold',fontSize:9,color:colors.primary},wantName:{fontFamily:'Inter_600SemiBold',fontSize:13,color:colors.foreground,minHeight:33},wantPrice:{fontFamily:'Inter_700Bold',fontSize:16,color:colors.foreground,marginTop:5},wantMeta:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:7},hypeScore:{fontFamily:'Inter_600SemiBold',fontSize:10,color:colors.primary},priceDrop:{flexDirection:'row',alignItems:'center',gap:5,marginTop:5},wasPrice:{fontFamily:'Inter_400Regular',fontSize:10,color:colors.mutedForeground,textDecorationLine:'line-through'},dropPercent:{fontFamily:'Inter_700Bold',fontSize:10,color:'#138A62'},remove:{position:'absolute',right:8,top:8,width:30,height:30,borderRadius:15,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},formLabel:{fontFamily:'Inter_700Bold',fontSize:14,color:colors.foreground,marginTop:20,marginBottom:8},selectBox:{height:72,borderWidth:1,borderColor:colors.border,borderRadius:16,flexDirection:'row',alignItems:'center',padding:8,gap:10},selectImage:{width:56,height:56,borderRadius:11},selectText:{fontFamily:'Inter_600SemiBold',fontSize:14,color:colors.foreground,flex:1},starPicker:{flexDirection:'row',gap:8},choiceRow:{flexDirection:'row',gap:10},choice:{flex:1,borderWidth:1,borderColor:colors.border,borderRadius:15,minHeight:52,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:7},choiceActive:{backgroundColor:colors.primary,borderColor:colors.primary},choiceText:{fontFamily:'Inter_600SemiBold',fontSize:13,color:colors.primary},choiceTextActive:{color:'#fff'},textArea:{height:125,paddingTop:14,textAlignVertical:'top'},mediaRow:{flexDirection:'row',gap:10,marginTop:14,marginBottom:20},mediaButton:{flex:1,minHeight:52,borderRadius:15,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8},mediaText:{fontFamily:'Inter_600SemiBold',fontSize:13,color:colors.foreground},profileTop:{flexDirection:'row',gap:14,alignItems:'center',paddingTop:42},profileAvatar:{width:72,height:72,borderRadius:36,backgroundColor:'#F4C8AE',alignItems:'center',justifyContent:'center'},profileInitial:{fontFamily:'Inter_700Bold',fontSize:28,color:'#7D4735'},profileName:{fontFamily:'Inter_700Bold',fontSize:19,color:colors.foreground},handle:{fontFamily:'Inter_400Regular',fontSize:12,color:colors.mutedForeground,marginTop:2},bio:{fontFamily:'Inter_400Regular',fontSize:12,color:colors.foreground,marginTop:7},editButton:{borderWidth:1,borderColor:colors.border,borderRadius:12,paddingHorizontal:13,paddingVertical:8},editText:{fontFamily:'Inter_600SemiBold',fontSize:12,color:colors.foreground},profileStats:{flexDirection:'row',justifyContent:'space-between',paddingVertical:24,borderBottomWidth:1,borderColor:colors.border,marginBottom:18},profileReview:{paddingVertical:16,borderBottomWidth:1,borderColor:colors.border}
});

const passwordStyles = StyleSheet.create({
  field:{position:'relative'},
  input:{paddingRight:56},
  toggle:{position:'absolute',right:6,top:16,width:44,height:44,alignItems:'center',justifyContent:'center'},
});

const profileStyles = StyleSheet.create({
  content:{paddingBottom:128},
  header:{flexDirection:'row',alignItems:'flex-start',gap:16},
  avatar:{width:80,height:80,borderRadius:40,backgroundColor:'#F4C8AE',alignItems:'center',justifyContent:'center',flexShrink:0},
  avatarImage:{width:'100%',height:'100%',resizeMode:'cover'},
  identity:{flex:1,paddingTop:3},
  actions:{flexDirection:'row',alignItems:'center',gap:10,marginTop:17},
  editButton:{minHeight:42,paddingHorizontal:14,borderRadius:13,borderWidth:1,borderColor:colors.primary,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},
  editText:{fontFamily:'Inter_700Bold',fontSize:13,color:colors.primary},
  signOutButton:{minHeight:42,paddingHorizontal:8,justifyContent:'center'},
  signOutText:{fontFamily:'Inter_600SemiBold',fontSize:13,color:colors.mutedForeground},
  stats:{flexDirection:'row',justifyContent:'space-between',paddingVertical:20,borderBottomWidth:1,borderColor:colors.border},
  stat:{flex:1,alignItems:'center'},
  tabs:{flexDirection:'row',borderBottomWidth:1,borderColor:colors.border},
  tab:{flex:1,minHeight:48,alignItems:'center',justifyContent:'flex-end',position:'relative'},
  tabText:{fontFamily:'Inter_600SemiBold',fontSize:13,color:colors.mutedForeground,paddingBottom:12},
  tabTextActive:{color:colors.primary},
  tabIndicator:{position:'absolute',left:12,right:12,bottom:-1,height:3,borderRadius:3,backgroundColor:colors.primary},
  videoReviewCard:{height:160,borderRadius:14,backgroundColor:colors.foreground,marginBottom:12,alignItems:'center',justifyContent:'center'},
  videoReviewPlay:{width:48,height:48,borderRadius:24,backgroundColor:colors.primary,alignItems:'center',justifyContent:'center',marginBottom:9},
  videoReviewTitle:{fontFamily:'Inter_700Bold',fontSize:15,color:'#fff'},
  videoReviewCopy:{fontFamily:'Inter_500Medium',fontSize:12,color:'rgba(255,255,255,.72)',marginTop:3},
  tabContent:{paddingTop:3},
  reviewPhoto:{width:'100%',height:160,borderRadius:14,marginBottom:12},
  emptyState:{alignItems:'center',justifyContent:'center',paddingTop:50,paddingHorizontal:22,gap:9},
  createListButton:{marginTop:10,minWidth:160},
  wantRow:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:14,borderBottomWidth:1,borderColor:colors.border},
  wantImage:{width:62,height:62,borderRadius:15},
  wantInfo:{flex:1},
  modalBackdrop:{flex:1,backgroundColor:'rgba(28,17,20,.42)',alignItems:'center',justifyContent:'center',padding:24},
  listModal:{width:'100%',maxWidth:360,backgroundColor:colors.background,borderRadius:22,padding:24,alignItems:'center',gap:12},
  modalTitle:{fontFamily:'Inter_700Bold',fontSize:20,color:colors.foreground},
  modalCopy:{textAlign:'center',marginBottom:6},
  editorBackdrop:{flex:1,backgroundColor:colors.background},
  editorScrollView:{flex:1},
  editorScroll:{flexGrow:1,justifyContent:'flex-end'},
  editorModal:{flex:1,backgroundColor:colors.background,paddingHorizontal:22,paddingBottom:34},
  editorHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:18},
  closeButton:{width:42,height:42,borderRadius:21,backgroundColor:colors.muted,alignItems:'center',justifyContent:'center'},
  headerSpacer:{width:42,height:42},
  photoEditor:{flexDirection:'row',alignItems:'center',gap:14,marginBottom:19},
  editorAvatarWrap:{position:'relative'},
  editorAvatar:{width:66,height:66,borderRadius:33},
  cameraBadge:{position:'absolute',right:-2,bottom:-2,width:25,height:25,borderRadius:13,backgroundColor:colors.primary,borderWidth:2,borderColor:colors.background,alignItems:'center',justifyContent:'center'},
  photoEditorCopy:{gap:5},
  fieldLabel:{fontFamily:'Inter_700Bold',fontSize:13,color:colors.foreground},
  changePhotoText:{fontFamily:'Inter_700Bold',fontSize:13,color:colors.primary},
  editorInput:{backgroundColor:'#fff',borderWidth:1,borderColor:colors.border,borderRadius:14,minHeight:50,paddingHorizontal:14,fontFamily:'Inter_400Regular',fontSize:15,color:colors.foreground,marginTop:8,marginBottom:5},
  usernameInputRow:{flexDirection:'row',alignItems:'center',backgroundColor:'#fff',borderWidth:1,borderColor:colors.border,borderRadius:14,minHeight:50,marginTop:8,marginBottom:5,paddingLeft:14},
  usernamePrefix:{fontFamily:'Inter_700Bold',fontSize:15,color:colors.mutedForeground},
  usernameInput:{flex:1,minHeight:48,paddingHorizontal:6,fontFamily:'Inter_400Regular',fontSize:15,color:colors.foreground},
  validationText:{fontFamily:'Inter_500Medium',fontSize:12,lineHeight:17,color:'#C34141',marginBottom:9},
  mutedHint:{fontFamily:'Inter_500Medium',fontSize:12,lineHeight:17,color:colors.mutedForeground,marginBottom:9},
  availableText:{fontFamily:'Inter_600SemiBold',fontSize:12,lineHeight:17,color:'#138A62',marginBottom:9},
  bioLabelRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:8},
  characterCount:{fontFamily:'Inter_500Medium',fontSize:12,color:colors.mutedForeground},
  bioInput:{height:108,paddingTop:13},
  editorActions:{flexDirection:'row',gap:10,marginTop:17},
  cancelButton:{flex:1,minHeight:54,borderWidth:1,borderColor:colors.border,borderRadius:16,alignItems:'center',justifyContent:'center'},
  cancelText:{fontFamily:'Inter_700Bold',fontSize:15,color:colors.foreground},
  saveButton:{flex:1},
  saveDisabled:{opacity:.55},
});

const discoverStyles = StyleSheet.create({
  swipeDirections:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},
  directionLabel:{fontFamily:'Inter_700Bold',fontSize:9,color:colors.primary,letterSpacing:.5},
  filterIcon:{width:32,height:32,alignItems:'center',justifyContent:'center'},
  productMeta:{flexDirection:'row',alignItems:'center',gap:10,marginTop:8},
  compactRating:{flexDirection:'row',alignItems:'center',gap:3},
  ratingValue:{fontFamily:'Inter_700Bold',fontSize:13,color:'#fff'},
  hypeMetric:{flexDirection:'row',alignItems:'center',alignSelf:'flex-start',marginTop:8,backgroundColor:'rgba(0,0,0,.28)',borderRadius:12,paddingHorizontal:9,paddingVertical:5,gap:4},
  hypeEmoji:{fontSize:12},
  hypeNumber:{fontFamily:'Inter_700Bold',fontSize:14,color:'#fff'},
  hypeLabel:{fontFamily:'Inter_600SemiBold',fontSize:12,color:'#fff'},
  followButton:{marginLeft:'auto',borderWidth:1,borderColor:colors.primary,borderRadius:12,paddingHorizontal:10,paddingVertical:5},
  followText:{fontFamily:'Inter_700Bold',fontSize:11,color:colors.primary},
  modalBackdrop:{flex:1,backgroundColor:'rgba(28,17,20,.45)',justifyContent:'flex-end'},
  filterModal:{backgroundColor:colors.background,borderTopLeftRadius:26,borderTopRightRadius:26,padding:22,paddingBottom:34},
  modalHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:20},
  modalTitle:{fontFamily:'Inter_700Bold',fontSize:20,color:colors.foreground},
  filterLabel:{fontFamily:'Inter_700Bold',fontSize:12,color:colors.primary,letterSpacing:.5,marginTop:12},
  filterValue:{fontFamily:'Inter_500Medium',fontSize:16,color:colors.foreground,marginTop:4},
  mockedNote:{fontFamily:'Inter_400Regular',fontSize:12,lineHeight:18,color:colors.mutedForeground,marginVertical:20},
});
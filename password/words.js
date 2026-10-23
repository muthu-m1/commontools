/* Passphrase word list for Common Tools: common, easy-to-spell English words of 3 to 8 letters, lowercase a–z only.
   Duplicates are removed when loaded; the strength figure always uses the final count (WORDS.length). */
(function (root) {
  const RAW = `
able about above acid acorn across actor adapt admit adult advice affect afford afraid after again agent agree ahead aim
air airport aisle alarm album alert alien align alike alive alley allow almond alone along alpha already also alter always
amber amount amuse anchor ancient angle animal ankle answer antler anvil apart apple apply apron arch arctic arena argue
arm armor army aroma around arrive arrow art artist ash aside ask asleep aspen assist atlas atom attach attic auburn audio
august aunt author autumn avenue avocado awake award aware away awesome axis bacon badge bagel baker balance balcony bald
ball ballet bamboo banana band banjo bank banner barn barrel basil basin basket bath batch battery bay beach beacon bead
beak beam bean bear beard beaver become bed bee beef beetle begin behave behind believe bell belt bench berry best better
beyond bicycle big bike bird birth biscuit bison bite black blade blanket blast blaze blend bless blink block bloom blossom
blue blush board boat body boil bold bolt bone bonus book boost boot border borrow boss both bottle bottom bounce bow bowl
box brain branch brass brave bread break breeze brick bridge brief bright bring brisk broad bronze brook broom brother brown
brush bubble bucket buckle budget buffalo build bulb bundle bunny burger burrow bus bush butter button buyer buzz cabin cable
cactus cafe cake calm camel camera camp canal candle candy cannon canoe canvas canyon capital captain car caramel carbon card
cargo carpet carrot carry cart carve case cash castle casual catalog catch cattle cause cave cedar ceiling celery cell cellar
cement census center century cereal chain chair chalk chamber change channel chapter charge charm chart chase cheek cheese
chef cherry chess chest chicken chief child chime chimney chin chip choice choose chorus cider cinema circle circus citizen
city civil claim clam clap clarify class claw clay clean clear clerk clever click client cliff climb clinic clip clock close
cloth cloud clover clown club clue cluster coach coast coat cobalt cobra cocoa coconut code coffee coin collar collect color
column combine comet comfort comic common compass concert condor cone confirm connect contest cookie cool copper copy coral
cord core corn corner cost cotton couch country couple course cousin cover cowboy coyote crab craft crane crater crayon cream
credit creek crew cricket crisp crop cross crowd crown crumb crunch crystal cube cuckoo cup cupboard curious current curtain
curve cushion custom cycle cypress daisy dance dancer dawn day deal debate decade decide deck decor deer degree delay deliver
delta demand denim depth deputy desert design desk detail device dial diamond diary diet dinner direct discover dish display
distant ditch dive divide dock doctor dolphin domain donkey door double dove dragon drama draw drawer dream dress drift drill
drink drive drum duck dune during dust duty eager eagle early earn earth easel east easy echo eclipse edge editor effect
effort eight elbow elder elegant element elephant elevate eleven elk ember emerald employ empty enable end energy engine enjoy
enough enter entire entry envoy equal equip erase escape essay estate even evening event ever evolve exact example excite
exhibit exist exit exotic expand expert explain explore extra eye fabric face fact factory fade falcon fall family famous fan
fancy farm fashion father faucet favor feast feather feature fence fern ferry festival fetch fever few fiber fiction field fig
figure film filter final find finger finish fire firm first fish fitness five flag flame flash flat flavor fleet flight flint
float flock floor flour flower fluid flute focus fog foil fold folk follow food foot forest forge fork formal fortune forum
forward fossil found fox fragile frame free fresh friend fringe frog front frost fruit fuel full fun funny furnace future
gadget galaxy gallery game garage garden garlic gas gate gather gauge gear gecko gem general gentle genuine giant gift giraffe
give glacier glad glass glide globe glove glow glue goal goat gold golf goose gorilla gospel govern grace grain grand granite
grape graph grass gravel gravity great green grid grill grin grocery ground group grove grow guard guess guide guitar gulf gum
habit hair half hall hammer hammock hamster hand handle harbor hard harmony harvest hat hawk hazel head health heart heat hedge
height hello helmet help hen herb hero heron hidden high hike hill hint hip history hobby hockey hold hole holiday hollow home
honey hood hook hope horizon horn horse hose hotel hour house hover hub huge human humble humor hundred hunt hurry husky hut
ice icon idea ideal igloo image impact improve inch include income index indoor infant inform inlet inner input insect inside
invite iris iron island item ivory ivy jacket jaguar jam jar jazz jeans jelly jet jewel job jog join joke journal journey joy
judge juice jump jungle junior jury just kayak keen keep kernel kettle key keyboard kick kid kind king kiosk kit kitchen kite
kitten kiwi knee knife knock know koala label labor lace ladder lady lagoon lake lamb lamp land lane language lantern laptop
large laser later laugh launch laundry lava lawn layer leader leaf learn leather lecture left legend lemon lend length lens
leopard lesson letter level library license lift light lilac lily limb lime limit line linen link lion liquid list listen
little live lizard llama load loaf lobby lobster local lock lodge logic lonely long loop lotus loud lounge love lucky lumber
lunar lunch lung luxury lyrics machine magic magnet maid mail main major make mammal mango maple marble march margin marine
market marsh mask master match matter maze meadow meal measure medal media melody melon member memory mentor menu mercy merit
mesa message metal meteor method middle midnight mild milk mill mimic mind mineral minor mint minute mirror misty mitten mix
mobile model modern moment money monitor monkey month moon moose morning mosaic moss mother motion motor mountain mouse mouth
move movie much muffin mule muscle museum music mustard mutual myth nail name napkin narrow nation native nature navy near
neck needle neither nephew nerve nest net network neutral never new news next nice nickel night nimble noble nod noise noodle
normal north nose notable note nothing notice novel now number nurse nut oak oasis oatmeal object ocean october odor offer
office often olive omega once onion online open opera option orange orbit orchard orchid order ordinary organ orient original
orphan ostrich other otter outdoor outer output oval oven over owl owner oxygen oyster ozone pace pack paddle page paint
pair palace palm panda panel panther paper parade parcel parent park parrot party pass pasta patch path patio patrol pattern
pause peace peach peak peanut pear pebble pelican pen pencil penguin people pepper perfect permit person pet phone photo
phrase piano picnic picture piece pig pigeon pillow pilot pine pink pioneer pipe pitch pizza place planet plant
plate play plaza pledge plenty plum plus pocket poem poet point polar pole police pond pony pool popcorn poppy portal pottery
powder power praise prepare present pretty price pride primary prince print prism prize problem process produce profit
program project proof proud provide public pudding pull pulse pumpkin punch pupil puppy purple purpose puzzle pyramid quail
quarter queen quest quick quiet quilt quiz quote rabbit raccoon race rack radar radio rail rain rainbow raise raisin rally
ranch random range rapid raven razor reach ready real reason rebel recall recipe record reduce reef reflect region relax
relief remain remote rent repair repeat reply report rescue resort result retire return review reward rhythm rib ribbon rice
rich ridge rifle right rigid ring ripple rival river road roast robin robot rocket rodeo roof rookie room rooster root rope
rose rotate rough round route royal rubber ruby rug rule ruler rumor runway rural saddle safari safe sail salad salmon salon
salt salute same sample sand sandal satin sauce sausage save scale scarf scene scheme school science scissors scooter score
scout screen script scroll sea seal season seat second secret section seed segment select sense series service session
settle seven shadow shallow shape share shark sheep shelf shell shelter sheriff shield shift shine ship shirt shoe shore short
shoulder shovel show shrimp shrub sibling side siege sight signal silent silk silver similar simple siren sister six size
skate sketch ski skill skirt sky slab sled sleep sleeve slice slide slim slogan slot slow small smart smile smoke smooth snack
snail snake snow soap soccer social sock soda sofa soft solar soldier solid solo solve song soon sound soup source south space
spare spark speak special speed spell spend sphere spice spider spike spin spirit splash sponge spoon sport spot spray spread
spring spruce square squash squirrel stable stadium staff stage stairs stamp stand star start state station statue steady
steam steel stem step stereo stick still stock stomach stone stool story stove straw stream street stride string strong
student studio stuff style subject submit subway sugar suit summer summit sun sunny sunset super supply supreme surface
surge survey sushi swallow swamp swan sweater sweet swift swim swing switch sword symbol syrup system table tackle tag tail
talent tank tape target task taste tattoo taxi tea teach team tell temple ten tenant tennis tent term test text thank theme
theory thing thought thrive thumb thunder ticket tide tiger tilt timber time tiny tip tissue title toast today toddler token
tomato tone tongue tonight tool tooth topic torch tornado tortoise total tourist toward tower town toy track trade traffic
trail train transit travel tray treat tree trend trial tribe trick trigger trim trip trophy trouble truck true trumpet trust
truth tube tulip tuna tunnel turkey turn turtle tutor twelve twenty twice twin twist type typical umbrella uncle under unfold
uniform union unique unit universe until update upgrade uphold upon upper urban usage useful usual utility vacuum valid valley
valve van vanilla vapor various vault velvet vendor venture venue verb verify version vessel veteran viable vibrant victory
video view village vintage violin virtual visa visit visual vital vivid vocal voice volcano volume vote voyage wafer wagon
waist walk wall walnut walrus wander warm warrior wash wasp water wave wax way wealth weather weave web wedding weekend welcome
west wet whale wheat wheel whip whisper wide width wife wild willow win window wine wing winner winter wire wisdom wise wish
witness wizard wolf woman wonder wood wool word work world worth wrap wreath wrist write yacht yard year yellow yoga yogurt
young youth zebra zero zigzag zinc zipper zone zoo
`;
  const seen = new Set();
  const WORDS = RAW.split(/\s+/).filter((w) => /^[a-z]{3,8}$/.test(w) && !seen.has(w) && seen.add(w));
  if (typeof module === 'object' && module.exports) module.exports = WORDS;
  else root.WORDS = WORDS;
})(typeof self !== 'undefined' ? self : this);

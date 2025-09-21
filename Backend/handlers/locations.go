package handlers

import (
    "context"
    "encoding/json"
    "math"
    "net/http"
    "time"

    "github.com/gorilla/mux"
    "go.mongodb.org/mongo-driver/bson"
    "go.mongodb.org/mongo-driver/bson/primitive"
    "go.mongodb.org/mongo-driver/mongo"

    "nearby-locations-api/models"
    "nearby-locations-api/utils"
)

var collection *mongo.Collection

func InitHandler() {
    collection = utils.DB.Collection("locations")
}

func measureTime(start time.Time) int64 {
    return time.Since(start).Nanoseconds()
}

func AddLocation(w http.ResponseWriter, r *http.Request) {
    start := time.Now()
    var loc models.Location
    _ = json.NewDecoder(r.Body).Decode(&loc)

    res, err := collection.InsertOne(context.Background(), loc)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    id := res.InsertedID.(primitive.ObjectID).Hex()
    response := map[string]interface{}{
        "id":      id,
        "time_ns": measureTime(start),
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}

func GetLocationsByCategory(w http.ResponseWriter, r *http.Request) {
    start := time.Now()
    category := mux.Vars(r)["category"]

    cur, err := collection.Find(context.Background(), bson.M{"category": category})
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    defer cur.Close(context.Background())

    var locations []models.Location
    for cur.Next(context.Background()) {
        var loc models.Location
        cur.Decode(&loc)
        locations = append(locations, loc)
    }

    response := map[string]interface{}{
        "locations": locations,
        "time_ns":   measureTime(start),
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}

func SearchLocations(w http.ResponseWriter, r *http.Request) {
    start := time.Now()
    var req struct {
        Latitude  float64 `json:"latitude"`
        Longitude float64 `json:"longitude"`
        Category  string  `json:"category"`
        RadiusKm  float64 `json:"radius_km"`
    }
    _ = json.NewDecoder(r.Body).Decode(&req)

    cur, _ := collection.Find(context.Background(), bson.M{"category": req.Category})
    defer cur.Close(context.Background())

    var nearby []map[string]interface{}
    for cur.Next(context.Background()) {
        var loc models.Location
        cur.Decode(&loc)

        dist := haversine(req.Latitude, req.Longitude, loc.Latitude, loc.Longitude)
        if dist <= req.RadiusKm {
            nearby = append(nearby, map[string]interface{}{
                "id":       loc.ID.Hex(),
                "name":     loc.Name,
                "address":  loc.Address,
                "distance": dist,
                "category": loc.Category,
            })
        }
    }

    response := map[string]interface{}{
        "locations": nearby,
        "time_ns":   measureTime(start),
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}

func haversine(lat1, lon1, lat2, lon2 float64) float64 {
    const R = 6371 // Earth radius km
    dLat := (lat2 - lat1) * math.Pi / 180.0
    dLon := (lon2 - lon1) * math.Pi / 180.0
    a := math.Sin(dLat/2)*math.Sin(dLat/2) +
        math.Cos(lat1*math.Pi/180.0)*math.Cos(lat2*math.Pi/180.0)*
            math.Sin(dLon/2)*math.Sin(dLon/2)
    c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
    return R * c
}

// POST /trip-cost/{location_id}
func TripCost(w http.ResponseWriter, r *http.Request) {
    start := time.Now()
    vars := mux.Vars(r)
    locationID := vars["location_id"]

    objID, err := primitive.ObjectIDFromHex(locationID)
    if err != nil {
        http.Error(w, "Invalid location ID", http.StatusBadRequest)
        return
    }

    // Fetch destination from DB
    var dest models.Location
    err = collection.FindOne(context.Background(), bson.M{"_id": objID}).Decode(&dest)
    if err != nil {
        http.Error(w, "Location not found", http.StatusNotFound)
        return
    }

    // Parse request body (user's current location)
    var req struct {
        Latitude  float64 `json:"latitude"`
        Longitude float64 `json:"longitude"`
    }
    _ = json.NewDecoder(r.Body).Decode(&req)

    // Call TollGuru API
    apiKey := os.Getenv("TOLLGURU_API_KEY")
    if apiKey == "" {
        http.Error(w, "TOLLGURU_API_KEY not set", http.StatusInternalServerError)
        return
    }

    tollReq := map[string]interface{}{
        "from": map[string]float64{
            "lat": req.Latitude,
            "lng": req.Longitude,
        },
        "to": map[string]float64{
            "lat": dest.Latitude,
            "lng": dest.Longitude,
        },
        "vehicleType": "2AxlesAuto",
    }

    body, _ := json.Marshal(tollReq)
    client := &http.Client{Timeout: 15 * time.Second}
    tollAPIURL := "https://apis.tollguru.com/toll/v2/origin-destination-waypoints"

    tollRequest, _ := http.NewRequest("POST", tollAPIURL, bytes.NewBuffer(body))
    tollRequest.Header.Set("Content-Type", "application/json")
    tollRequest.Header.Set("x-api-key", apiKey)

    resp, err := client.Do(tollRequest)
    if err != nil {
        http.Error(w, "Error calling TollGuru API", http.StatusInternalServerError)
        return
    }
    defer resp.Body.Close()

    var tollResp map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&tollResp)

    // Extract costs safely
    route, ok := tollResp["route"].(map[string]interface{})
    if !ok {
        http.Error(w, "Invalid response from TollGuru", http.StatusInternalServerError)
        return
    }

    summary, ok := route["costs"].(map[string]interface{})
    if !ok {
        http.Error(w, "Cost data missing in TollGuru response", http.StatusInternalServerError)
        return
    }

    response := map[string]interface{}{
        "total_cost": summary["overall"],
        "fuel_cost":  summary["fuel"],
        "toll_cost":  summary["tolls"],
        "time_ns":    measureTime(start),
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}


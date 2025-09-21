package main

import (
    "log"
    "net/http"

    "github.com/gorilla/mux"
    "nearby-locations-api/handlers"
    "nearby-locations-api/utils"
)

func main() {
    utils.InitDB()
    handlers.InitHandler()

    r := mux.NewRouter()
    r.HandleFunc("/locations", handlers.AddLocation).Methods("POST")
    r.HandleFunc("/locations/{category}", handlers.GetLocationsByCategory).Methods("GET")
    r.HandleFunc("/search", handlers.SearchLocations).Methods("POST")

    log.Println("🚀 Server running on :8080")
    log.Fatal(http.ListenAndServe(":8080", r))
	r.HandleFunc("/trip-cost/{location_id}", handlers.TripCost).Methods("POST")

}

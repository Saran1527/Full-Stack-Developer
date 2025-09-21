package models

import "go.mongodb.org/mongo-driver/bson/primitive"

type Location struct {
    ID        primitive.ObjectID `json:"id,omitempty" bson:"_id,omitempty"`
    Name      string             `json:"name" bson:"name"`
    Address   string             `json:"address" bson:"address"`
    Latitude  float64            `json:"latitude" bson:"latitude"`
    Longitude float64            `json:"longitude" bson:"longitude"`
    Category  string             `json:"category" bson:"category"`
}
